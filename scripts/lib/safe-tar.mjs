import { gunzipSync } from 'node:zlib';
import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { parse, relative, resolve, sep } from 'node:path';
import { assertPortableRelativePath, portablePathCollisionKey } from './portable-path.mjs';

export const SAFE_TAR_LIMITS = Object.freeze({
  maxArchiveBytes: 64 * 1024 * 1024,
  maxUncompressedBytes: 256 * 1024 * 1024,
  maxEntryBytes: 64 * 1024 * 1024,
  maxEntries: 10_000,
});

function limit(options, name) {
  const value = options[name] ?? SAFE_TAR_LIMITS[name];
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`archive ${name} limit must be a positive safe integer`);
  return value;
}

function numericField(buffer, start, length) {
  return buffer.subarray(start, start + length).toString('ascii').replace(/\0.*$/su, '').trim();
}

function textField(buffer, start, length, label) {
  const bytes = buffer.subarray(start, start + length);
  const nul = bytes.indexOf(0);
  const content = nul === -1 ? bytes : bytes.subarray(0, nul);
  if (nul !== -1 && bytes.subarray(nul + 1).some((byte) => byte !== 0)) {
    throw new Error(`${label} contains non-zero data after its NUL terminator`);
  }
  let value;
  try {
    value = new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch (error) {
    throw new Error(`${label} is not valid UTF-8`, { cause: error });
  }
  if (/\p{Cc}/u.test(value)) throw new Error(`${label} contains a control character`);
  return value;
}

function octal(buffer, start, length) {
  const value = numericField(buffer, start, length);
  if (!value) return 0;
  if (!/^[0-7]+$/u.test(value)) throw new Error(`archive header contains an invalid octal field: ${value}`);
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed)) throw new Error(`archive header octal field is outside the safe integer range: ${value}`);
  return parsed;
}

function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function ensureSafeDirectory(path, mode = 0o700) {
  const existing = lstatIfPresent(path);
  if (existing) {
    if (existing.isSymbolicLink() || !existing.isDirectory()) throw new Error(`archive destination component is not a real directory: ${path}`);
    return false;
  }
  mkdirSync(path, { mode });
  try { chmodSync(path, mode); } catch (error) {
    if (process.platform !== 'win32') throw error;
  }
  return true;
}

function ensureSafeDirectoryTree(path, mode = 0o700) {
  const absolute = resolve(path);
  const { root } = parse(absolute);
  const parts = relative(root, absolute).split(sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    const next = resolve(current, part);
    const existing = lstatIfPresent(next);
    if (existing?.isSymbolicLink()) {
      // macOS commonly exposes /var and /tmp as root-level aliases. Normalize
      // that platform boundary, but reject links inside the caller-owned path.
      if (current !== root) throw new Error(`archive destination component is a symlink: ${next}`);
      current = realpathSync.native(next);
      continue;
    }
    ensureSafeDirectory(next, mode);
    current = next;
  }
  return current;
}

function ensureSafeParents(destination, entryPath, createdDirectories) {
  let parent = destination;
  const parts = entryPath.split('/');
  for (const part of parts.slice(0, -1)) {
    parent = resolve(parent, part);
    if (ensureSafeDirectory(parent)) createdDirectories.add(parent);
  }
}

function preflightExtractionTargets(root, entries) {
  for (const entry of entries) {
    let current = root;
    const parts = entry.path.split('/');
    for (let index = 0; index < parts.length; index += 1) {
      current = resolve(current, parts[index]);
      const existing = lstatIfPresent(current);
      if (!existing) break;
      const final = index === parts.length - 1;
      if (existing.isSymbolicLink() || !existing.isDirectory()) {
        if (final && entry.type !== 'directory') {
          throw new Error(`archive extraction refuses to replace an existing path: ${entry.path}`);
        }
        throw new Error(`archive destination component is not a real directory: ${current}`);
      }
      if (final && entry.type !== 'directory') {
        throw new Error(`archive extraction refuses to replace an existing path: ${entry.path}`);
      }
    }
  }
}

function removeFailedSafeFile(target, created, operationError, label) {
  const cleanupErrors = [];
  try {
    const current = lstatIfPresent(target);
    if (current) {
      if (current.isSymbolicLink() || !current.isFile() || current.nlink !== 1
        || !sameIdentity(current, created)) {
        throw new Error(`${label} changed identity before failed-write cleanup`);
      }
      let unlinkError = null;
      try { unlinkSync(target); } catch (error) { unlinkError = error; }
      if (lstatIfPresent(target)) {
        throw unlinkError ?? new Error(`${label} remained after failed-write cleanup`);
      }
    }
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      [operationError, ...cleanupErrors],
      `${label} write failed and cleanup was incomplete: ${operationError.message}`,
    );
  }
  throw operationError;
}

function writeSafeArchiveFile(target, content, mode, label) {
  const noFollow = constants.O_NOFOLLOW ?? 0;
  let descriptor;
  let created;
  let operationError = null;
  try {
    try {
      descriptor = openSync(
        target,
        constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | noFollow,
        mode,
      );
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        const observed = lstatIfPresent(target);
        if (observed) {
          if (observed.isSymbolicLink() || !observed.isFile() || observed.nlink !== 1) {
            throw new AggregateError(
              [error, new Error(`${label} appeared with an unsafe type after exclusive create failed`)],
              `${label} exclusive create failed with an ambiguous outcome: ${error.message}`,
            );
          }
          created = observed;
        }
      }
      throw error;
    }
    created = fstatSync(descriptor);
    if (!created.isFile() || created.nlink !== 1) throw new Error(`${label} is not a single-link file`);
    if (process.platform !== 'win32') fchmodSync(descriptor, mode);
    const adjusted = fstatSync(descriptor);
    if (!sameIdentity(created, adjusted)
      || (process.platform !== 'win32' && (adjusted.mode & 0o777) !== mode)) {
      throw new Error(`${label} did not retain its archive mode`);
    }
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    const written = fstatSync(descriptor);
    if (!sameIdentity(adjusted, written) || written.nlink !== 1
      || written.size !== content.length
      || (process.platform !== 'win32' && (written.mode & 0o777) !== mode)) {
      throw new Error(`${label} byte count or mode differs from its archive entry`);
    }
    const observed = Buffer.alloc(content.length);
    let offset = 0;
    while (offset < observed.length) {
      const bytesRead = readSync(descriptor, observed, offset, observed.length - offset, offset);
      if (bytesRead <= 0) throw new Error(`${label} could not be read back completely`);
      offset += bytesRead;
    }
    if (!observed.equals(content)) throw new Error(`${label} bytes differ from its archive entry`);
    const confirmed = fstatSync(descriptor);
    const published = lstatSync(target);
    if (!sameIdentity(written, confirmed) || !sameIdentity(written, published)
      || confirmed.nlink !== 1 || published.nlink !== 1
      || confirmed.size !== written.size || published.size !== written.size
      || (process.platform !== 'win32' && (
        (confirmed.mode & 0o777) !== mode || (published.mode & 0o777) !== mode
      ))) {
      throw new Error(`${label} changed while its bytes and mode were verified`);
    }
  } catch (error) {
    operationError = error;
  }
  if (descriptor !== undefined) {
    try { closeSync(descriptor); } catch (error) { operationError ??= error; }
  }
  if (operationError) {
    if (created) removeFailedSafeFile(target, created, operationError, label);
    throw operationError;
  }
}

function directoryDepth(path) {
  return path.split('/').length;
}

function applyFinalDirectoryModes(directories) {
  const deepestFirst = [...directories].sort((left, right) => (
    directoryDepth(right.entryPath) - directoryDepth(left.entryPath)
      || right.entryPath.localeCompare(left.entryPath, 'en')
  ));
  const applied = [];
  try {
    for (const directory of deepestFirst) {
      chmodSync(directory.target, directory.mode);
      applied.push(directory);
    }
  } catch (error) {
    // Unlock parents before children so an atomic extraction wrapper can
    // traverse and remove its private temporary directory after failure.
    for (const directory of [...applied].sort((left, right) => (
      directoryDepth(left.entryPath) - directoryDepth(right.entryPath)
        || left.entryPath.localeCompare(right.entryPath, 'en')
    ))) {
      try { chmodSync(directory.target, 0o700); } catch { /* retain the original failure */ }
    }
    throw error;
  }
}

function safeRelativePath(path, label) {
  return assertPortableRelativePath(path, label);
}

export function validateTarEntry(entry, { allowSymlinks = false } = {}) {
  safeRelativePath(entry.path, 'archive entry');
  if (!['file', 'directory', ...(allowSymlinks ? ['symlink'] : [])].includes(entry.type)) {
    throw new Error(`archive entry type is forbidden: ${entry.type}`);
  }
  if (entry.type === 'symlink') {
    if (Buffer.byteLength(entry.target ?? '', 'utf8') > 100) throw new Error(`archive symlink target is too long: ${entry.path}`);
    safeRelativePath(entry.target, 'archive symlink target');
  }
  return entry;
}

function validateTarTopology(entries) {
  const entriesByCollisionKey = new Map(entries.map((entry) => [portablePathCollisionKey(entry.path), entry]));
  for (const entry of entries) {
    const parts = entry.path.split('/');
    for (let length = 1; length < parts.length; length += 1) {
      const ancestorPath = parts.slice(0, length).join('/');
      const ancestor = entriesByCollisionKey.get(portablePathCollisionKey(ancestorPath));
      if (ancestor && ancestor.type !== 'directory') {
        throw new Error(`archive entry has a non-directory ancestor: ${ancestor.path} blocks ${entry.path}`);
      }
    }
  }
}

export function parseTarEntries(tar, options = {}) {
  const maxUncompressedBytes = limit(options, 'maxUncompressedBytes');
  const maxEntryBytes = limit(options, 'maxEntryBytes');
  const maxEntries = limit(options, 'maxEntries');
  if (tar.length > maxUncompressedBytes) {
    throw new Error(`archive uncompressed size exceeds ${maxUncompressedBytes} bytes`);
  }
  const entries = [];
  const paths = new Set();
  const collisionKeys = new Map();
  let terminated = false;
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      const secondTerminator = tar.subarray(offset + 512, offset + 1024);
      if (secondTerminator.length !== 512 || !secondTerminator.every((byte) => byte === 0)) {
        throw new Error('archive is missing the second zero terminator block');
      }
      if (!tar.subarray(offset + 1024).every((byte) => byte === 0)) {
        throw new Error('archive contains non-zero data after its terminator');
      }
      terminated = true;
      break;
    }
    const storedChecksum = octal(header, 148, 8);
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const actualChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0);
    if (storedChecksum !== actualChecksum) throw new Error('archive header checksum differs');
    const name = textField(header, 0, 100, 'archive entry name');
    if (!name) throw new Error('archive entry name must not be empty');
    const prefix = textField(header, 345, 155, 'archive entry prefix');
    const rawPath = prefix ? `${prefix}/${name}` : name;
    const typeFlag = textField(header, 156, 1, 'archive entry type') || '0';
    const type = typeFlag === '0' ? 'file' : typeFlag === '5' ? 'directory' : typeFlag === '2' ? 'symlink' : ({ '1': 'hardlink', '3': 'device', '4': 'device', '6': 'fifo' }[typeFlag] ?? `unknown-${typeFlag}`);
    const size = octal(header, 124, 12);
    if (size > maxEntryBytes) throw new Error(`archive entry exceeds ${maxEntryBytes} bytes: ${rawPath}`);
    if (entries.length >= maxEntries) throw new Error(`archive contains more than ${maxEntries} entries`);
    const entryPath = type === 'directory' && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
    const entry = validateTarEntry({ path: entryPath, type, mode: octal(header, 100, 8), size, target: type === 'symlink' ? textField(header, 157, 100, 'archive symlink target') : undefined }, options);
    if (paths.has(entry.path)) throw new Error(`archive contains a duplicate entry path: ${entry.path}`);
    paths.add(entry.path);
    const collisionKey = portablePathCollisionKey(entry.path);
    const existingCollision = collisionKeys.get(collisionKey);
    if (existingCollision && existingCollision !== entry.path) {
      throw new Error(`archive contains a normalized case collision: ${existingCollision} and ${entry.path}`);
    }
    collisionKeys.set(collisionKey, entry.path);
    if (entry.type !== 'file' && entry.size !== 0) throw new Error(`archive ${entry.type} entry has non-zero content: ${entry.path}`);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > tar.length) throw new Error(`archive entry content is truncated: ${entry.path}`);
    entries.push({ ...entry, content: type === 'file' ? tar.subarray(contentStart, contentEnd) : Buffer.alloc(0) });
    const nextOffset = contentStart + Math.ceil(size / 512) * 512;
    if (nextOffset > tar.length) throw new Error(`archive entry padding is truncated: ${entry.path}`);
    if (tar.subarray(contentEnd, nextOffset).some((byte) => byte !== 0)) {
      throw new Error(`archive entry has non-zero padding: ${entry.path}`);
    }
    offset = nextOffset;
  }
  if (!terminated) throw new Error('archive is missing its zero terminator blocks');
  validateTarTopology(entries);
  return entries;
}

export function parseTarGzEntries(archive, options = {}) {
  const maxArchiveBytes = limit(options, 'maxArchiveBytes');
  const maxUncompressedBytes = limit(options, 'maxUncompressedBytes');
  if (archive.length > maxArchiveBytes) throw new Error(`archive compressed size exceeds ${maxArchiveBytes} bytes`);
  let tar;
  try {
    tar = gunzipSync(archive, { maxOutputLength: maxUncompressedBytes });
  } catch (error) {
    if (error?.code === 'ERR_BUFFER_TOO_LARGE' || /maxOutputLength|larger than/u.test(error?.message ?? '')) {
      throw new Error(`archive uncompressed size exceeds ${maxUncompressedBytes} bytes`, { cause: error });
    }
    throw error;
  }
  return parseTarEntries(tar, options);
}

export function extractSafeTarGz(archive, destination, options = {}) {
  const entries = parseTarGzEntries(archive, options);
  const root = ensureSafeDirectoryTree(destination, 0o700);
  preflightExtractionTargets(root, entries);
  const createdDirectories = new Set();
  const finalDirectoryModes = [];
  for (const entry of entries) {
    ensureSafeParents(root, entry.path, createdDirectories);
    const target = resolve(root, entry.path);
    if (target === root) throw new Error(`archive entry resolves to the extraction root: ${entry.path}`);
    const mode = entry.mode & 0o777;
    const existing = lstatIfPresent(target);
    if (entry.type === 'directory') {
      if (ensureSafeDirectory(target, 0o700)) createdDirectories.add(target);
      // Keep every archive-owned directory traversable until all children are
      // present. Restrictive final modes are applied only after extraction.
      if (createdDirectories.has(target)) {
        try { chmodSync(target, 0o700); } catch (error) {
          if (process.platform !== 'win32') throw error;
        }
      }
      finalDirectoryModes.push({ entryPath: entry.path, target, mode });
    }
    else if (entry.type === 'file') {
      if (existing) throw new Error(`archive extraction refuses to replace an existing path: ${entry.path}`);
      writeSafeArchiveFile(target, entry.content, mode, `archive file ${entry.path}`);
    } else {
      if (existing) throw new Error(`archive extraction refuses to replace an existing path: ${entry.path}`);
      symlinkSync(entry.target, target);
    }
  }
  if (process.platform !== 'win32') applyFinalDirectoryModes(finalDirectoryModes);
  return entries.map(({ content, ...entry }) => entry);
}

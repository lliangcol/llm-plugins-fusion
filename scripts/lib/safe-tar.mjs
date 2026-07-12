import { gunzipSync } from 'node:zlib';
import { chmodSync, lstatSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

function field(buffer, start, length) {
  return buffer.subarray(start, start + length).toString('utf8').replace(/\0.*$/su, '').trim();
}

function octal(buffer, start, length) {
  const value = field(buffer, start, length);
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

function ensureSafeDirectory(path, mode = 0o700, { recursive = false } = {}) {
  const existing = lstatIfPresent(path);
  if (existing) {
    if (existing.isSymbolicLink() || !existing.isDirectory()) throw new Error(`archive destination component is not a real directory: ${path}`);
    return;
  }
  mkdirSync(path, { mode, recursive });
}

function ensureSafeParents(destination, entryPath) {
  let parent = destination;
  const parts = entryPath.split('/');
  for (const part of parts.slice(0, -1)) {
    parent = resolve(parent, part);
    ensureSafeDirectory(parent);
  }
}

function safeRelativePath(path, label) {
  if (!path || isAbsolute(path) || path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/u.test(path) || path.includes('\\')) {
    throw new Error(`${label} is not a portable relative path: ${path}`);
  }
  if (path.split('/').some((part) => part === '..' || part === '')) throw new Error(`${label} contains traversal or an empty component: ${path}`);
  return path.replace(/\/$/u, '');
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

export function parseTarEntries(tar, options = {}) {
  const entries = [];
  const paths = new Set();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const storedChecksum = octal(header, 148, 8);
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const actualChecksum = checksumHeader.reduce((sum, byte) => sum + byte, 0);
    if (storedChecksum !== actualChecksum) throw new Error('archive header checksum differs');
    const name = field(header, 0, 100);
    const prefix = field(header, 345, 155);
    const rawPath = prefix ? `${prefix}/${name}` : name;
    const typeFlag = field(header, 156, 1) || '0';
    const type = typeFlag === '0' ? 'file' : typeFlag === '5' ? 'directory' : typeFlag === '2' ? 'symlink' : ({ '1': 'hardlink', '3': 'device', '4': 'device', '6': 'fifo' }[typeFlag] ?? `unknown-${typeFlag}`);
    const size = octal(header, 124, 12);
    const entry = validateTarEntry({ path: rawPath.replace(/\/$/u, ''), type, mode: octal(header, 100, 8), size, target: type === 'symlink' ? field(header, 157, 100) : undefined }, options);
    if (paths.has(entry.path)) throw new Error(`archive contains a duplicate entry path: ${entry.path}`);
    paths.add(entry.path);
    if (entry.type !== 'file' && entry.size !== 0) throw new Error(`archive ${entry.type} entry has non-zero content: ${entry.path}`);
    const contentStart = offset + 512;
    const contentEnd = contentStart + size;
    if (contentEnd > tar.length) throw new Error(`archive entry content is truncated: ${entry.path}`);
    entries.push({ ...entry, content: type === 'file' ? tar.subarray(contentStart, contentEnd) : Buffer.alloc(0) });
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

export function extractSafeTarGz(archive, destination, options = {}) {
  const entries = parseTarEntries(gunzipSync(archive), options);
  const root = resolve(destination);
  ensureSafeDirectory(root, 0o700, { recursive: true });
  for (const entry of entries) {
    ensureSafeParents(root, entry.path);
    const target = resolve(root, entry.path);
    const mode = entry.mode & 0o777;
    const existing = lstatIfPresent(target);
    if (entry.type === 'directory') {
      ensureSafeDirectory(target, mode);
      try { chmodSync(target, mode); } catch { /* platform may not support POSIX modes */ }
    }
    else if (entry.type === 'file') {
      if (existing) throw new Error(`archive extraction refuses to replace an existing path: ${entry.path}`);
      writeFileSync(target, entry.content, { flag: 'wx', mode });
      try { chmodSync(target, mode); } catch { /* platform may not support POSIX modes */ }
    } else {
      if (existing) throw new Error(`archive extraction refuses to replace an existing path: ${entry.path}`);
      symlinkSync(entry.target, target);
    }
  }
  return entries.map(({ content, ...entry }) => entry);
}

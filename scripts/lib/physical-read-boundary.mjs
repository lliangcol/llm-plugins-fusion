import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  chmodSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  readSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

function isContained(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..' && !value.startsWith(`..${sep}`));
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function samePortableMode(left, right) {
  return (left.mode & 0o777) === (right.mode & 0o777);
}

function sameStableMetadata(left, right) {
  return sameIdentity(left, right)
    && left.size === right.size
    && left.nlink === right.nlink
    && left.mode === right.mode
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

function committedFileState(stat, label) {
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must remain a physical regular file`);
  }
  if (stat.nlink !== 1n) throw new Error(`${label} must remain single-link`);
  return {
    dev: stat.dev,
    ino: stat.ino,
    nlink: stat.nlink,
    mode: stat.mode,
    size: stat.size,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs,
  };
}

function committedDirectoryState(stat, label) {
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must remain a physical directory`);
  }
  return {
    dev: stat.dev,
    ino: stat.ino,
    nlink: stat.nlink,
    mode: stat.mode,
    size: stat.size,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs,
  };
}

function sameCommittedState(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.nlink === right.nlink
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function samePreAndPostRenameFileState(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.nlink === right.nlink
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs;
}

function samePreAndPostRenameDirectoryState(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.nlink === right.nlink
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs;
}

function digestDescriptor(descriptor, size, label) {
  if (size > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} is too large to verify safely`);
  }
  const total = Number(size);
  const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, Math.max(1, total)));
  const hash = createHash('sha256');
  let position = 0;
  while (position < total) {
    const length = Math.min(chunk.length, total - position);
    const bytesRead = readSync(descriptor, chunk, 0, length, position);
    if (bytesRead <= 0) throw new Error(`${label} could not be read back completely`);
    hash.update(chunk.subarray(0, bytesRead));
    position += bytesRead;
  }
  return { bytes: total, sha256: hash.digest('hex') };
}

function requireDirectory(stat, label) {
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must be a physical directory, not a symlink or junction`);
  }
}

function requireRegularFile(stat, label) {
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a physical regular file, not a symlink or junction`);
  }
  if (stat.nlink !== 1) throw new Error(`${label} must not be hard linked`);
}

function lexicalPath(boundary, path, label, allowRoot) {
  const lexical = resolve(path);
  if (!isContained(boundary.lexicalRoot, lexical) || (!allowRoot && lexical === boundary.lexicalRoot)) {
    throw new Error(`${label} escapes its physical read boundary`);
  }
  return lexical;
}

function requirePhysicalContainment(boundary, lexical, label) {
  const physical = realpathSync.native(lexical);
  if (!isContained(boundary.physicalRoot, physical)) {
    throw new Error(`${label} escapes its physical read boundary`);
  }
  return physical;
}

function requireBoundaryIdentity(boundary) {
  const current = committedDirectoryState(
    lstatSync(boundary.lexicalRoot, { bigint: true }),
    boundary.label,
  );
  if (current.dev !== boundary.rootState.dev || current.ino !== boundary.rootState.ino
    || realpathSync.native(boundary.lexicalRoot) !== boundary.physicalRoot) {
    throw new Error(`${boundary.label} changed identity while it was in use`);
  }
}

// Node does not expose openat(2)/NtCreateFile-style descriptor-relative path
// traversal. Holding the root descriptor plus nanosecond metadata detects
// ordinary swap-and-restore races, while every target still has its own inode
// checks. A same-UID actor on a filesystem that does not surface rename/change
// metadata can remain a residual limitation until Node exposes such APIs.
function openBoundaryReadLease(boundary) {
  requireBoundaryIdentity(boundary);
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const directoryOnly = constants.O_DIRECTORY ?? 0;
  let descriptor;
  try {
    descriptor = openSync(
      boundary.lexicalRoot,
      constants.O_RDONLY | directoryOnly | noFollow,
    );
  } catch (error) {
    // Node cannot open directory handles on every Windows filesystem. The
    // path-state fallback remains fail-closed for persistent replacement, but
    // it cannot provide the same descriptor binding as POSIX.
    if (process.platform !== 'win32' || !['EACCES', 'EINVAL', 'EISDIR', 'EPERM'].includes(error?.code)) throw error;
  }
  try {
    const beforePath = committedDirectoryState(
      lstatSync(boundary.lexicalRoot, { bigint: true }),
      boundary.label,
    );
    const beforeDescriptor = descriptor === undefined
      ? beforePath
      : committedDirectoryState(
          fstatSync(descriptor, { bigint: true }),
          `${boundary.label} descriptor`,
        );
    if (!sameCommittedState(beforePath, beforeDescriptor)
      || beforeDescriptor.dev !== boundary.rootState.dev
      || beforeDescriptor.ino !== boundary.rootState.ino
      || realpathSync.native(boundary.lexicalRoot) !== boundary.physicalRoot) {
      throw new Error(`${boundary.label} changed identity while its read lease was opened`);
    }
    return { descriptor, before: beforeDescriptor };
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    throw error;
  }
}

function closeBoundaryReadLease(boundary, lease) {
  try {
    const afterPath = committedDirectoryState(
      lstatSync(boundary.lexicalRoot, { bigint: true }),
      boundary.label,
    );
    const afterDescriptor = lease.descriptor === undefined
      ? afterPath
      : committedDirectoryState(
          fstatSync(lease.descriptor, { bigint: true }),
          `${boundary.label} descriptor`,
        );
    if (!sameCommittedState(lease.before, afterDescriptor)
      || !sameCommittedState(afterDescriptor, afterPath)
      || realpathSync.native(boundary.lexicalRoot) !== boundary.physicalRoot) {
      throw new Error(`${boundary.label} changed identity or metadata while its read lease was held`);
    }
  } finally {
    if (lease.descriptor !== undefined) closeSync(lease.descriptor);
  }
}

function walkParents(boundary, lexical, label) {
  const value = relative(boundary.lexicalRoot, lexical);
  const parts = value === '' ? [] : value.split(sep);
  let current = boundary.lexicalRoot;
  for (const part of parts.slice(0, -1)) {
    current = resolve(current, part);
    requireDirectory(lstatSync(current), `${label} parent`);
  }
}

function prepareParentDirectories(boundary, lexical, label, createParents) {
  const value = relative(boundary.lexicalRoot, dirname(lexical));
  const parts = value === '' ? [] : value.split(sep);
  let current = boundary.lexicalRoot;
  for (const part of parts) {
    const parent = current;
    current = resolve(current, part);
    const observed = lstatIfPresent(current);
    if (!observed) {
      if (!createParents) {
        const error = Object.assign(new Error(`${label} parent does not exist: ${current}`), { code: 'ENOENT' });
        throw error;
      }
      requireBoundaryIdentity(boundary);
      if (parent !== boundary.lexicalRoot) {
        captureDirectoryIdentity(boundary, parent, `${label} parent`);
      }
      try {
        mkdirSync(current, { mode: 0o700 });
      } catch (error) {
        if (error?.code === 'EEXIST') {
          throw new Error(`${label} parent appeared while its physical path was prepared`);
        }
        throw error;
      }
      setPathModeReconciled(current, 0o700, `${label} parent`);
    }
    captureDirectoryIdentity(boundary, current, `${label} parent`);
  }
}

function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function captureDirectoryIdentity(boundary, lexical, label) {
  const before = lstatSync(lexical);
  requireDirectory(before, label);
  const physical = requirePhysicalContainment(boundary, lexical, label);
  const after = lstatSync(lexical);
  requireDirectory(after, label);
  if (!sameIdentity(before, after) || realpathSync.native(lexical) !== physical) {
    throw new Error(`${label} changed identity while it was inspected`);
  }
  return { lexical, physical, dev: after.dev, ino: after.ino };
}

function verifyDirectoryIdentity(boundary, expected, label) {
  walkParents(boundary, expected.lexical, label);
  const current = lstatSync(expected.lexical);
  requireDirectory(current, label);
  if (!sameIdentity(current, expected)
    || realpathSync.native(expected.lexical) !== expected.physical
    || !isContained(boundary.physicalRoot, expected.physical)) {
    throw new Error(`${label} changed identity while it was in use`);
  }
}

function captureOptionalFileIdentity(boundary, lexical, label) {
  const before = lstatIfPresent(lexical);
  if (!before) return null;
  requireRegularFile(before, label);
  const physical = requirePhysicalContainment(boundary, lexical, label);
  const after = lstatSync(lexical);
  requireRegularFile(after, label);
  if (!sameIdentity(before, after)
    || !samePortableMode(before, after)
    || realpathSync.native(lexical) !== physical) {
    throw new Error(`${label} changed identity or mode while it was inspected`);
  }
  return {
    physical,
    dev: after.dev,
    ino: after.ino,
    mode: after.mode & 0o777,
    size: after.size,
    mtimeMs: after.mtimeMs,
    ctimeMs: after.ctimeMs,
  };
}

function verifyOptionalFileIdentity(boundary, lexical, expected, label) {
  const current = lstatIfPresent(lexical);
  if (!expected) {
    if (current) throw new Error(`${label} appeared while its atomic write was prepared`);
    return;
  }
  if (!current) throw new Error(`${label} disappeared while its atomic write was prepared`);
  requireRegularFile(current, label);
  if (!sameIdentity(current, expected)
    || !samePortableMode(current, expected)
    || current.size !== expected.size
    || current.mtimeMs !== expected.mtimeMs
    || current.ctimeMs !== expected.ctimeMs
    || realpathSync.native(lexical) !== expected.physical
    || !isContained(boundary.physicalRoot, expected.physical)) {
    throw new Error(`${label} changed identity or mode while its atomic write was prepared`);
  }
}

function cleanupStagedFile(boundary, parent, temporaryPath, staged) {
  try {
    verifyDirectoryIdentity(boundary, parent, 'atomic write parent');
    const current = lstatIfPresent(temporaryPath);
    if (!current) return null;
    requireRegularFile(current, 'atomic write temporary file');
    if (!sameIdentity(current, staged)) {
      return new Error('atomic write temporary file changed identity before cleanup');
    }
    try {
      unlinkSync(temporaryPath);
    } catch (error) {
      if (lstatIfPresent(temporaryPath)) return error;
    }
    if (lstatIfPresent(temporaryPath)) {
      return new Error('atomic write temporary file remained after cleanup');
    }
    return null;
  } catch (error) {
    // A changed parent is not safe to traverse for cleanup. Report the
    // residual object rather than hiding a potentially sensitive stage.
    return error;
  }
}

function cleanupUnidentifiedStagedFile(boundary, parent, temporaryPath) {
  try {
    verifyDirectoryIdentity(boundary, parent, 'atomic write parent');
    const current = lstatIfPresent(temporaryPath);
    if (!current) return null;
    requireRegularFile(current, 'atomic write temporary file');
    try {
      unlinkSync(temporaryPath);
    } catch (error) {
      if (lstatIfPresent(temporaryPath)) return error;
    }
    if (lstatIfPresent(temporaryPath)) {
      return new Error('atomic write unidentified temporary file remained after cleanup');
    }
    return null;
  } catch (error) {
    // An exclusive create that reports EEXIST is never routed here. For any
    // other failed create, report an object that could not be removed safely.
    return error;
  }
}

function setPathModeReconciled(path, mode, label, expected = null) {
  const before = lstatSync(path);
  if (before.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link`);
  if (expected && !sameIdentity(before, expected)) throw new Error(`${label} changed identity before chmod`);
  let operationError = null;
  try {
    chmodSync(path, mode);
  } catch (error) {
    operationError = error;
  }
  const after = lstatSync(path);
  if (!sameIdentity(before, after) || (after.mode & 0o777) !== mode) {
    if (operationError) throw operationError;
    throw new Error(`${label} did not retain mode ${mode.toString(8)}`);
  }
}

function makePhysicalTreeRemovable(path, label) {
  const status = lstatSync(path);
  if (status.isSymbolicLink()) return;
  if (!status.isDirectory()) return;
  setPathModeReconciled(path, (status.mode & 0o777) | 0o700, label, status);
  for (const name of readdirSync(path)) {
    const child = resolve(path, name);
    const childStatus = lstatSync(child);
    if (childStatus.isDirectory() && !childStatus.isSymbolicLink()) {
      makePhysicalTreeRemovable(child, `${label} child`);
    }
  }
}

function snapshotPhysicalDirectoryTree(root, label) {
  const records = [];
  const noFollow = constants.O_NOFOLLOW ?? 0;

  function visit(path, relativePath) {
    const before = lstatSync(path);
    const mode = before.mode & 0o777;
    if (before.isSymbolicLink()) {
      const target = readlinkSync(path);
      const after = lstatSync(path);
      if (!after.isSymbolicLink() || !sameIdentity(before, after) || (after.mode & 0o777) !== mode) {
        throw new Error(`${label} symbolic link changed while its manifest was captured: ${relativePath}`);
      }
      records.push({ path: relativePath, type: 'symlink', mode, target });
      return;
    }

    if (before.isDirectory()) {
      const widenedMode = mode | 0o500;
      if (widenedMode !== mode) setPathModeReconciled(path, widenedMode, `${label} directory`, before);
      let names;
      try {
        names = readdirSync(path).sort();
        for (const name of names) {
          visit(resolve(path, name), relativePath ? `${relativePath}/${name}` : name);
        }
        const confirmedNames = readdirSync(path).sort();
        if (names.length !== confirmedNames.length
          || names.some((name, index) => name !== confirmedNames[index])) {
          throw new Error(`${label} directory contents changed while its manifest was captured: ${relativePath}`);
        }
      } finally {
        if (widenedMode !== mode) setPathModeReconciled(path, mode, `${label} directory`, before);
      }
      const after = lstatSync(path);
      if (!after.isDirectory() || after.isSymbolicLink()
        || !sameIdentity(before, after) || (after.mode & 0o777) !== mode) {
        throw new Error(`${label} directory changed while its manifest was captured: ${relativePath}`);
      }
      records.push({ path: relativePath, type: 'directory', mode });
      return;
    }

    if (!before.isFile() || before.nlink !== 1) {
      throw new Error(`${label} contains a non-regular or hard-linked entry: ${relativePath}`);
    }
    const widenedMode = mode | 0o400;
    if (widenedMode !== mode) setPathModeReconciled(path, widenedMode, `${label} file`, before);
    let descriptor;
    let digest;
    try {
      descriptor = openSync(path, constants.O_RDONLY | noFollow);
      const opened = fstatSync(descriptor, { bigint: true });
      const openedIdentity = { dev: Number(opened.dev), ino: Number(opened.ino) };
      if (!opened.isFile() || opened.nlink !== 1n || !sameIdentity(before, openedIdentity)) {
        throw new Error(`${label} file changed before its manifest was captured: ${relativePath}`);
      }
      const openedState = committedFileState(opened, `${label} file`);
      digest = digestDescriptor(descriptor, openedState.size, `${label} file`);
      const afterDigest = committedFileState(fstatSync(descriptor, { bigint: true }), `${label} file`);
      if (!sameCommittedState(openedState, afterDigest)) {
        throw new Error(`${label} file changed while its manifest was captured: ${relativePath}`);
      }
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
      if (widenedMode !== mode) setPathModeReconciled(path, mode, `${label} file`, before);
    }
    const after = lstatSync(path);
    if (!after.isFile() || after.isSymbolicLink() || after.nlink !== 1
      || !sameIdentity(before, after) || (after.mode & 0o777) !== mode
      || after.size !== digest.bytes) {
      throw new Error(`${label} file changed while its manifest was finalized: ${relativePath}`);
    }
    records.push({ path: relativePath, type: 'file', mode, bytes: digest.bytes, sha256: digest.sha256 });
  }

  visit(root, '');
  return records.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

function sameDirectoryManifest(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cleanupOwnedDirectory(boundary, parent, path, expected, entryLabel) {
  try {
    verifyDirectoryIdentity(boundary, parent, 'atomic directory parent');
    const current = lstatIfPresent(path);
    if (!current) return null;
    requireDirectory(current, entryLabel);
    if (!sameIdentity(current, expected)) {
      return new Error(`${entryLabel} changed identity before cleanup`);
    }
    makePhysicalTreeRemovable(path, entryLabel);
    let operationError = null;
    try {
      rmSync(path, { recursive: true, force: true });
    } catch (error) {
      operationError = error;
    }
    if (lstatIfPresent(path)) {
      return operationError ?? new Error(`${entryLabel} remained after cleanup`);
    }
    return null;
  } catch (error) {
    // A changed parent is not safe to traverse for cleanup. Report the
    // residual directory rather than silently treating cleanup as complete.
    return error;
  }
}

function cleanupStagedDirectory(boundary, parent, temporaryPath, staged) {
  return cleanupOwnedDirectory(
    boundary,
    parent,
    temporaryPath,
    staged,
    'atomic temporary directory',
  );
}

function cleanupPublishedDirectory(boundary, parent, path, published) {
  return cleanupOwnedDirectory(
    boundary,
    parent,
    path,
    published,
    'atomic published directory',
  );
}

function cleanupUnidentifiedStagedDirectory(boundary, parent, temporaryPath) {
  try {
    verifyDirectoryIdentity(boundary, parent, 'atomic directory parent');
    const current = lstatIfPresent(temporaryPath);
    if (!current) return null;
    requireDirectory(current, 'atomic temporary directory');
    makePhysicalTreeRemovable(temporaryPath, 'atomic temporary directory');
    let operationError = null;
    try {
      rmSync(temporaryPath, { recursive: true, force: true });
    } catch (error) {
      operationError = error;
    }
    if (lstatIfPresent(temporaryPath)) {
      return operationError ?? new Error('atomic unidentified temporary directory remained after cleanup');
    }
    return null;
  } catch (error) {
    // See cleanupUnidentifiedStagedFile. A changed parent is reported.
    return error;
  }
}

/**
 * Establishes the lexical and physical roots used for all subsequent reads.
 * Symlinks above the caller-selected root are intentionally outside this boundary.
 */
export function createPhysicalReadBoundary(root, label = 'read boundary') {
  const lexicalRoot = resolve(root);
  const before = committedDirectoryState(lstatSync(lexicalRoot, { bigint: true }), label);
  const physicalRoot = realpathSync.native(lexicalRoot);
  const after = committedDirectoryState(lstatSync(lexicalRoot, { bigint: true }), label);
  if (!sameCommittedState(before, after) || realpathSync.native(lexicalRoot) !== physicalRoot) {
    throw new Error(`${label} changed identity while its boundary was established`);
  }
  return Object.freeze({
    lexicalRoot,
    physicalRoot,
    label,
    rootState: Object.freeze({ ...after }),
  });
}

export function readPhysicalDirectory(boundary, path, label = 'directory') {
  const rootLease = openBoundaryReadLease(boundary);
  try {
    const lexical = lexicalPath(boundary, path, label, true);
    walkParents(boundary, lexical, label);
    const before = lstatSync(lexical);
    requireDirectory(before, label);
    const physical = requirePhysicalContainment(boundary, lexical, label);
    const names = readdirSync(lexical).sort();
    const after = lstatSync(lexical);
    requireDirectory(after, label);
    if (!sameStableMetadata(before, after) || realpathSync.native(lexical) !== physical) {
      throw new Error(`${label} changed identity or metadata while it was read`);
    }
    const confirmedNames = readdirSync(lexical).sort();
    const confirmed = lstatSync(lexical);
    requireDirectory(confirmed, label);
    if (!sameStableMetadata(after, confirmed)
      || realpathSync.native(lexical) !== physical
      || names.length !== confirmedNames.length
      || names.some((name, index) => name !== confirmedNames[index])) {
      throw new Error(`${label} changed identity, metadata, or contents while it was read`);
    }
    return names;
  } finally {
    closeBoundaryReadLease(boundary, rootLease);
  }
}

export function readPhysicalFile(boundary, path, label = 'file') {
  const rootLease = openBoundaryReadLease(boundary);
  let descriptor;
  try {
    const lexical = lexicalPath(boundary, path, label, false);
    walkParents(boundary, lexical, label);
    const before = lstatSync(lexical);
    requireRegularFile(before, label);
    const physical = requirePhysicalContainment(boundary, lexical, label);
    const noFollow = constants.O_NOFOLLOW ?? 0;
    descriptor = openSync(lexical, constants.O_RDONLY | noFollow);
    const opened = fstatSync(descriptor);
    requireRegularFile(opened, label);
    if (!sameStableMetadata(before, opened)) {
      throw new Error(`${label} changed identity or metadata before it was opened`);
    }
    const buffer = readFileSync(descriptor);
    const afterRead = fstatSync(descriptor);
    requireRegularFile(afterRead, label);
    if (!sameStableMetadata(opened, afterRead) || buffer.length !== afterRead.size) {
      throw new Error(`${label} changed identity or metadata while it was read`);
    }
    const after = lstatSync(lexical);
    requireRegularFile(after, label);
    if (!sameStableMetadata(afterRead, after) || realpathSync.native(lexical) !== physical) {
      throw new Error(`${label} changed identity or metadata while it was read`);
    }
    return {
      buffer,
      bytes: buffer.length,
      mode: opened.mode & 0o777,
      dev: opened.dev,
      ino: opened.ino,
      physicalPath: physical,
      path: lexical,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    closeBoundaryReadLease(boundary, rootLease);
  }
}

/**
 * Validate every existing component of a prospective file write without
 * creating any parent directory. Multi-output callers use this in a complete
 * first pass so an invalid later target cannot leave earlier parent trees.
 */
export function validatePhysicalFileWritePath(boundary, path, label = 'file') {
  requireBoundaryIdentity(boundary);
  const lexical = lexicalPath(boundary, path, label, false);
  const value = relative(boundary.lexicalRoot, dirname(lexical));
  const parts = value === '' ? [] : value.split(sep);
  let current = boundary.lexicalRoot;
  let parentsExist = true;
  for (const part of parts) {
    current = resolve(current, part);
    if (!lstatIfPresent(current)) {
      parentsExist = false;
      break;
    }
    captureDirectoryIdentity(boundary, current, `${label} parent`);
  }
  if (parentsExist) captureOptionalFileIdentity(boundary, lexical, label);
  requireBoundaryIdentity(boundary);
  return lexical;
}

/**
 * Prepare an atomic output target without creating or replacing the target.
 * Missing parent directories are created one level at a time and every
 * existing component is required to remain a physical directory. Existing
 * targets must be single-link regular files.
 */
export function preparePhysicalFileWrite(boundary, path, label = 'file', { createParents = true } = {}) {
  requireBoundaryIdentity(boundary);
  const lexical = lexicalPath(boundary, path, label, false);
  prepareParentDirectories(boundary, lexical, label, createParents);
  const parent = captureDirectoryIdentity(boundary, dirname(lexical), `${label} parent`);
  const original = captureOptionalFileIdentity(boundary, lexical, label);
  verifyDirectoryIdentity(boundary, parent, `${label} parent`);
  verifyOptionalFileIdentity(boundary, lexical, original, label);
  requireBoundaryIdentity(boundary);
  return Object.freeze({
    kind: 'physical-file-write-lease-v1',
    boundary,
    parent: Object.freeze({ ...parent }),
    original: original ? Object.freeze({ ...original }) : null,
    path: lexical,
    parentPath: parent.lexical,
    targetExists: original !== null,
    targetIdentity: original ? Object.freeze({ dev: original.dev, ino: original.ino }) : null,
  });
}

/**
 * Atomically replaces a repository file without following linked parents or targets.
 * The temporary file is created exclusively in the verified target directory.
 */
export function writePhysicalFileAtomically(
  boundary,
  path,
  content,
  label = 'file',
  { preparation = null, mode = null } = {},
) {
  requireBoundaryIdentity(boundary);
  const lexical = lexicalPath(boundary, path, label, false);
  const lease = preparation ?? preparePhysicalFileWrite(boundary, lexical, label);
  if (lease?.kind !== 'physical-file-write-lease-v1' || lease.boundary !== boundary || lease.path !== lexical) {
    throw new Error(`${label} atomic write preparation does not match its physical boundary and target`);
  }
  const { parent, original } = lease;
  if (mode !== null && (!Number.isSafeInteger(mode) || mode < 0 || mode > 0o777)) {
    throw new Error(`${label} atomic write mode must be an integer between 000 and 777`);
  }
  const desiredMode = mode ?? original?.mode ?? 0o600;
  const expectedSha256 = createHash('sha256').update(content).digest('hex');
  verifyDirectoryIdentity(boundary, parent, `${label} parent`);
  verifyOptionalFileIdentity(boundary, lexical, original, label);
  const temporaryPath = resolve(parent.lexical, `.${basename(lexical)}.${randomUUID()}.tmp`);
  const noFollow = constants.O_NOFOLLOW ?? 0;
  let descriptor;
  let staged;
  let stagedPhysical;
  let committed = false;
  let operationError = null;
  try {
    try {
      descriptor = openSync(
        temporaryPath,
        constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | noFollow,
        desiredMode,
      );
    } catch (error) {
      // Fault-injected and unusual platform wrappers can create the exclusive
      // temporary file and then report an error. EEXIST, however, means the
      // object may be foreign and must be preserved.
      if (error?.code !== 'EEXIST') {
        const cleanupError = cleanupUnidentifiedStagedFile(boundary, parent, temporaryPath);
        if (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            `${label} temporary file creation failed and cleanup was incomplete: ${error.message}`,
          );
        }
      }
      throw error;
    }
    staged = fstatSync(descriptor);
    requireRegularFile(staged, `${label} temporary file`);
    // open(2)'s mode is filtered by umask. Capture the new inode first so a
    // failed chmod remains cleanable, then reapply and verify the leased mode.
    fchmodSync(descriptor, desiredMode);
    const modeAdjusted = fstatSync(descriptor);
    requireRegularFile(modeAdjusted, `${label} temporary file`);
    if (!sameIdentity(staged, modeAdjusted) || (modeAdjusted.mode & 0o777) !== desiredMode) {
      throw new Error(`${label} temporary file did not retain its intended mode`);
    }
    staged = modeAdjusted;
    requireBoundaryIdentity(boundary);
    verifyDirectoryIdentity(boundary, parent, `${label} parent`);
    stagedPhysical = requirePhysicalContainment(boundary, temporaryPath, `${label} temporary file`);
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    const afterWrite = fstatSync(descriptor);
    requireRegularFile(afterWrite, `${label} temporary file`);
    if (!sameIdentity(staged, afterWrite) || !samePortableMode(staged, afterWrite)) {
      throw new Error(`${label} temporary file changed identity or mode while it was written`);
    }
    requireBoundaryIdentity(boundary);
    verifyDirectoryIdentity(boundary, parent, `${label} parent`);
    verifyOptionalFileIdentity(boundary, lexical, original, label);
    const beforeRename = lstatSync(temporaryPath);
    requireRegularFile(beforeRename, `${label} temporary file`);
    if (!sameIdentity(staged, beforeRename) || !samePortableMode(staged, beforeRename)) {
      throw new Error(`${label} temporary file changed identity or mode before commit`);
    }
    if (requirePhysicalContainment(boundary, temporaryPath, `${label} temporary file`) !== stagedPhysical) {
      throw new Error(`${label} temporary file changed physical location before commit`);
    }
    const stagedCommitState = committedFileState(
      fstatSync(descriptor, { bigint: true }),
      `${label} temporary file`,
    );
    const stagedPathState = committedFileState(
      lstatSync(temporaryPath, { bigint: true }),
      `${label} temporary file`,
    );
    if (!sameCommittedState(stagedCommitState, stagedPathState)) {
      throw new Error(`${label} temporary file changed before its committed bytes were verified`);
    }
    const stagedDigest = digestDescriptor(descriptor, stagedCommitState.size, `${label} temporary file`);
    const afterStagedDigestDescriptorState = committedFileState(
      fstatSync(descriptor, { bigint: true }),
      `${label} temporary file`,
    );
    const afterStagedDigestPathState = committedFileState(
      lstatSync(temporaryPath, { bigint: true }),
      `${label} temporary file`,
    );
    if (!sameCommittedState(stagedCommitState, afterStagedDigestDescriptorState)
      || !sameCommittedState(stagedCommitState, afterStagedDigestPathState)) {
      throw new Error(`${label} temporary file changed while its bytes were verified`);
    }
    if (stagedDigest.sha256 !== expectedSha256) {
      throw new Error(`${label} temporary bytes do not match the requested content`);
    }

    try {
      renameSync(temporaryPath, lexical);
      committed = true;
    } catch (error) {
      // A wrapper may throw after rename(2) has already committed. Reconcile
      // against the staged inode so callers do not receive a false failure for
      // an output that is already published.
      const temporaryAfterError = lstatIfPresent(temporaryPath);
      const publishedAfterError = lstatIfPresent(lexical);
      if (temporaryAfterError || !publishedAfterError) throw error;
      requireRegularFile(publishedAfterError, label);
      if (!sameIdentity(staged, publishedAfterError) || !samePortableMode(staged, publishedAfterError)) {
        throw error;
      }
      committed = true;
    }

    verifyDirectoryIdentity(boundary, parent, `${label} parent`);
    const committedDescriptorState = committedFileState(
      fstatSync(descriptor, { bigint: true }),
      label,
    );
    const committedPathState = committedFileState(
      lstatSync(lexical, { bigint: true }),
      label,
    );
    if (!samePreAndPostRenameFileState(stagedCommitState, committedDescriptorState)
      || !sameCommittedState(committedDescriptorState, committedPathState)) {
      throw new Error(`${label} changed identity, content metadata, or mode during atomic commit`);
    }
    requirePhysicalContainment(boundary, lexical, label);
    const actual = digestDescriptor(descriptor, committedDescriptorState.size, label);
    const afterDigestDescriptorState = committedFileState(
      fstatSync(descriptor, { bigint: true }),
      label,
    );
    const afterDigestPathState = committedFileState(
      lstatSync(lexical, { bigint: true }),
      label,
    );
    if (!sameCommittedState(committedDescriptorState, afterDigestDescriptorState)
      || !sameCommittedState(committedDescriptorState, afterDigestPathState)) {
      throw new Error(`${label} changed while its committed bytes were verified`);
    }
    if (actual.sha256 !== expectedSha256) {
      throw new Error(`${label} committed bytes do not match the requested content`);
    }
    requireBoundaryIdentity(boundary);
    return {
      bytes: actual.bytes,
      mode: Number(committedDescriptorState.mode & 0o777n),
      path: lexical,
      sha256: actual.sha256,
    };
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    const cleanupErrors = [];
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch (error) { cleanupErrors.push(error); }
    }
    if (!committed && staged) {
      const cleanupError = cleanupStagedFile(boundary, parent, temporaryPath, staged);
      if (cleanupError) cleanupErrors.push(cleanupError);
    }
    if (cleanupErrors.length > 0) {
      if (operationError) {
        throw new AggregateError(
          [operationError, ...cleanupErrors],
          `${label} atomic write failed and cleanup was incomplete: ${operationError.message}`,
        );
      }
      throw new AggregateError(cleanupErrors, `${label} atomic write cleanup was incomplete`);
    }
  }
}

/**
 * Populate a private sibling directory and publish it with one rename. The
 * destination must not already exist, which prevents extraction from merging
 * with or partially replacing caller-owned content.
 */
export function writePhysicalDirectoryAtomically(
  boundary,
  path,
  populate,
  label = 'directory',
  { preparation = null } = {},
) {
  requireBoundaryIdentity(boundary);
  const lexical = lexicalPath(boundary, path, label, false);
  const lease = preparation ?? preparePhysicalFileWrite(boundary, lexical, label);
  if (lease?.kind !== 'physical-file-write-lease-v1' || lease.boundary !== boundary || lease.path !== lexical) {
    throw new Error(`${label} atomic directory preparation does not match its physical boundary and target`);
  }
  if (lease.original) throw new Error(`${label} must not already exist`);
  const { parent } = lease;
  verifyDirectoryIdentity(boundary, parent, `${label} parent`);
  verifyOptionalFileIdentity(boundary, lexical, null, label);
  const temporaryPath = resolve(parent.lexical, `.${basename(lexical)}.${randomUUID()}.tmp-dir`);
  let staged;
  let committed = false;
  let result;
  let operationError = null;
  try {
    try {
      mkdirSync(temporaryPath, { mode: 0o700 });
    } catch (error) {
      // Preserve an EEXIST object because it was not created by this attempt.
      if (error?.code !== 'EEXIST') {
        const cleanupError = cleanupUnidentifiedStagedDirectory(boundary, parent, temporaryPath);
        if (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            `${label} temporary directory creation failed and cleanup was incomplete: ${error.message}`,
          );
        }
      }
      throw error;
    }
    const created = lstatSync(temporaryPath);
    requireDirectory(created, `${label} temporary directory`);
    staged = { dev: created.dev, ino: created.ino };
    setPathModeReconciled(temporaryPath, 0o700, `${label} temporary directory`, created);
    staged = captureDirectoryIdentity(boundary, temporaryPath, `${label} temporary directory`);
    result = populate(temporaryPath);
    if (result && typeof result.then === 'function') {
      throw new Error(`${label} atomic directory population must be synchronous`);
    }
    requireBoundaryIdentity(boundary);
    verifyDirectoryIdentity(boundary, parent, `${label} parent`);
    verifyOptionalFileIdentity(boundary, lexical, null, label);
    verifyDirectoryIdentity(boundary, staged, `${label} temporary directory`);
    const stagedManifest = snapshotPhysicalDirectoryTree(temporaryPath, `${label} temporary directory`);
    verifyDirectoryIdentity(boundary, staged, `${label} temporary directory`);
    const stagedCommitState = committedDirectoryState(
      lstatSync(temporaryPath, { bigint: true }),
      `${label} temporary directory`,
    );
    try {
      renameSync(temporaryPath, lexical);
      committed = true;
    } catch (error) {
      const temporaryAfterError = lstatIfPresent(temporaryPath);
      const publishedAfterError = lstatIfPresent(lexical);
      if (temporaryAfterError || !publishedAfterError) throw error;
      requireDirectory(publishedAfterError, label);
      if (!sameIdentity(staged, publishedAfterError)) throw error;
      committed = true;
    }
    const published = captureDirectoryIdentity(boundary, lexical, label);
    if (!sameIdentity(published, staged)) throw new Error(`${label} changed identity during atomic commit`);
    const publishedManifest = snapshotPhysicalDirectoryTree(lexical, label);
    if (!sameDirectoryManifest(stagedManifest, publishedManifest)) {
      throw new Error(`${label} contents changed during atomic commit`);
    }
    const publishedState = committedDirectoryState(lstatSync(lexical, { bigint: true }), label);
    if (!samePreAndPostRenameDirectoryState(stagedCommitState, publishedState)) {
      throw new Error(`${label} changed metadata during atomic commit`);
    }
    requireBoundaryIdentity(boundary);
    const verifiedPublishedState = committedDirectoryState(lstatSync(lexical, { bigint: true }), label);
    if (!sameCommittedState(publishedState, verifiedPublishedState)) {
      throw new Error(`${label} changed while its atomic commit was verified`);
    }
    return { path: lexical, result };
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    if (staged && (!committed || operationError)) {
      const cleanupError = committed
        ? cleanupPublishedDirectory(boundary, parent, lexical, staged)
        : cleanupStagedDirectory(boundary, parent, temporaryPath, staged);
      if (cleanupError) {
        if (operationError) {
          throw new AggregateError(
            [operationError, cleanupError],
            `${label} atomic directory write failed and cleanup was incomplete: ${operationError.message}`,
          );
        }
        throw cleanupError;
      }
    }
  }
}

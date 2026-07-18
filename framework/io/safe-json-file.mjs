import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

function isContained(root, target) {
  const rel = relative(root, target);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function requireDirectory(stats, label) {
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`${label} must be a physical directory, not a symbolic link`);
  }
}

function requireFile(stats, label) {
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${label} must be a physical regular file, not a symbolic link`);
  }
  if (stats.nlink !== 1) throw new Error(`${label} must not be hard linked`);
}

function sameFileState(left, right) {
  return sameIdentity(left, right)
    && left.size === right.size
    && left.mode === right.mode
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs
    && left.nlink === right.nlink;
}

function containedFileSnapshot(root, path, { read = false } = {}) {
  if (typeof root !== 'string' || root.length === 0) throw new TypeError('spec root must be a non-empty string');
  if (typeof path !== 'string' || path.length === 0 || path.includes('\0')) throw new TypeError('spec path must be a non-empty relative string');
  if (isAbsolute(path)) throw new Error(`absolute spec path is not allowed: ${path}`);

  const lexicalRoot = resolve(root);
  const rootBefore = lstatSync(lexicalRoot);
  requireDirectory(rootBefore, 'spec root');
  const realRoot = realpathSync.native(lexicalRoot);
  const lexicalTarget = resolve(realRoot, path);
  if (!isContained(realRoot, lexicalTarget)) throw new Error(`spec path escapes root: ${path}`);

  const parts = relative(realRoot, lexicalTarget).split(sep);
  const parentSnapshots = [];
  let cursor = realRoot;
  for (const component of parts.slice(0, -1)) {
    cursor = resolve(cursor, component);
    const stats = lstatSync(cursor);
    requireDirectory(stats, `spec path parent ${component}`);
    const physical = realpathSync.native(cursor);
    if (physical !== cursor || !isContained(realRoot, physical)) {
      throw new Error(`spec path contains a symbolic link or escapes root: ${path}`);
    }
    parentSnapshots.push({ path: cursor, physical, dev: stats.dev, ino: stats.ino });
  }

  const before = lstatSync(lexicalTarget);
  requireFile(before, `spec file ${path}`);
  const realTarget = realpathSync.native(lexicalTarget);
  if (!isContained(realRoot, realTarget) || realTarget !== lexicalTarget) {
    throw new Error(`spec path resolves outside root or through a symbolic link: ${path}`);
  }

  let buffer = null;
  let descriptor;
  try {
    if (read) {
      descriptor = openSync(lexicalTarget, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      const opened = fstatSync(descriptor);
      requireFile(opened, `spec file ${path}`);
      if (!sameFileState(before, opened)) throw new Error(`spec file changed before it was opened: ${path}`);
      buffer = readFileSync(descriptor);
      const afterRead = fstatSync(descriptor);
      requireFile(afterRead, `spec file ${path}`);
      if (!sameFileState(opened, afterRead)) throw new Error(`spec file changed while it was read: ${path}`);
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }

  const after = lstatSync(lexicalTarget);
  requireFile(after, `spec file ${path}`);
  if (!sameFileState(before, after) || realpathSync.native(lexicalTarget) !== realTarget) {
    throw new Error(`spec file changed while it was inspected: ${path}`);
  }
  for (const parent of parentSnapshots) {
    const current = lstatSync(parent.path);
    requireDirectory(current, `spec path parent ${parent.path}`);
    if (!sameIdentity(current, parent) || realpathSync.native(parent.path) !== parent.physical) {
      throw new Error(`spec path parent changed while it was inspected: ${path}`);
    }
  }
  const rootAfter = lstatSync(lexicalRoot);
  requireDirectory(rootAfter, 'spec root');
  if (!sameIdentity(rootBefore, rootAfter) || realpathSync.native(lexicalRoot) !== realRoot) {
    throw new Error('spec root changed while it was inspected');
  }
  return { buffer, realTarget };
}

/** Resolve an existing single-link regular file without lexical, symlink, or hard-link escapes. */
export function resolveContainedFile(root, path) {
  return containedFileSnapshot(root, path).realTarget;
}

export function readContainedJson(root, path) {
  const snapshot = containedFileSnapshot(root, path, { read: true });
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(snapshot.buffer);
  } catch {
    throw new Error(`spec file is not valid UTF-8: ${path}`);
  }
  return JSON.parse(source);
}

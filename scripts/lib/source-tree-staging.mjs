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
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  createPhysicalReadBoundary,
  writePhysicalDirectoryAtomically,
  writePhysicalFileAtomically,
} from './physical-read-boundary.mjs';
import { assertPortableRelativePath, portablePathCollisionKey } from './portable-path.mjs';

function isContained(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..' && !value.startsWith(`..${sep}`));
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function lstatIfPresent(path) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function nearestExisting(path) {
  let current = resolve(path);
  while (!lstatIfPresent(current)) {
    const parent = dirname(current);
    if (parent === current) throw new Error(`staged source output has no existing ancestor: ${path}`);
    current = parent;
  }
  return current;
}

function projectedPhysicalPath(path) {
  const lexical = resolve(path);
  const ancestor = nearestExisting(lexical);
  return resolve(realpathSync.native(ancestor), relative(ancestor, lexical));
}

function outputBoundary(path, label) {
  const ancestor = nearestExisting(dirname(resolve(path)));
  const status = lstatSync(ancestor);
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error(`${label} nearest existing parent must be a physical directory`);
  }
  return createPhysicalReadBoundary(ancestor, `${label} boundary`);
}

function requirePhysicalSourceFile(repoRoot, sourcePath, label) {
  const repo = resolve(repoRoot);
  const source = resolve(repo, ...sourcePath.split('/'));
  if (!isContained(repo, source) || source === repo) throw new Error(`${label} escapes the repository`);
  const repoStatus = lstatSync(repo);
  if (repoStatus.isSymbolicLink() || !repoStatus.isDirectory()) {
    throw new Error(`${label} repository root must be a physical directory`);
  }
  const before = lstatSync(source);
  if (before.isSymbolicLink() || !before.isFile()) throw new Error(`${label} must be a physical regular file`);
  if (before.nlink !== 1) throw new Error(`${label} must not be hard linked`);
  const physicalRepo = realpathSync.native(repo);
  const physicalSource = realpathSync.native(source);
  if (!isContained(physicalRepo, physicalSource) || physicalSource === physicalRepo) {
    throw new Error(`${label} escapes the repository`);
  }
  const after = lstatSync(source);
  if (!sameIdentity(before, after) || (before.mode & 0o777) !== (after.mode & 0o777)) {
    throw new Error(`${label} changed identity or mode while it was inspected`);
  }
  return { path: source, physicalPath: physicalSource, status: after };
}

function assertDistinctFileTarget(source, destination, label) {
  const target = resolve(destination);
  const existing = lstatIfPresent(target);
  if (target === source.path || projectedPhysicalPath(target) === source.physicalPath) {
    throw new Error(`${label} aliases its repository source`);
  }
  if (existing && !existing.isSymbolicLink() && sameIdentity(existing, source.status)) {
    throw new Error(`${label} aliases its repository source`);
  }
}

function assertDistinctTreeTarget(sourceRoot, destination, label) {
  const target = resolve(destination);
  const physicalTarget = projectedPhysicalPath(target);
  if (isContained(sourceRoot.path, target) || isContained(target, sourceRoot.path)
    || isContained(sourceRoot.physicalPath, physicalTarget)
    || isContained(physicalTarget, sourceRoot.physicalPath)) {
    throw new Error(`${label} aliases or overlaps its repository source tree`);
  }
}

function portableRelative(root, target) {
  const value = relative(root, target).split(sep).join('/');
  return assertPortableRelativePath(value, 'staged source path');
}

function physicalTreeFiles(sourceRoot, current = sourceRoot) {
  const entries = [];
  for (const entry of readdirSync(current, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    const path = resolve(current, entry.name);
    const relPath = portableRelative(sourceRoot, path);
    const status = lstatSync(path);
    if (status.isSymbolicLink()) throw new Error(`source tree contains a symbolic link: ${relPath}`);
    if (status.isDirectory()) entries.push(...physicalTreeFiles(sourceRoot, path));
    else if (status.isFile()) {
      if (status.nlink !== 1) throw new Error(`source tree file must not be hard linked: ${relPath}`);
      entries.push(relPath);
    } else throw new Error(`source tree contains a non-regular entry: ${relPath}`);
  }
  return entries.sort();
}

function validateManifest(prefix, manifest) {
  const normalizedPrefix = assertPortableRelativePath(prefix, 'source tree prefix');
  const prefixWithSlash = `${normalizedPrefix}/`;
  const collisionKeys = new Map();
  const relativePaths = manifest.map((path) => {
    assertPortableRelativePath(path, 'source tree manifest path');
    if (!path.startsWith(prefixWithSlash)) throw new Error(`source tree manifest path is outside ${prefix}: ${path}`);
    const relativePath = assertPortableRelativePath(path.slice(prefixWithSlash.length), 'source tree relative path');
    const collisionKey = portablePathCollisionKey(relativePath);
    const prior = collisionKeys.get(collisionKey);
    if (prior && prior !== relativePath) throw new Error(`source tree manifest contains a normalized path collision: ${prior} and ${relativePath}`);
    collisionKeys.set(collisionKey, relativePath);
    return relativePath;
  });
  if (new Set(relativePaths).size !== relativePaths.length) throw new Error(`source tree manifest contains duplicate paths under ${prefix}`);
  return relativePaths.sort();
}

function sourceMode(reader, sourcePath, fallback) {
  const value = typeof reader.fileMode === 'function' ? reader.fileMode(sourcePath) : fallback;
  if (!Number.isSafeInteger(value) || value < 0 || value > 0o777) {
    throw new Error(`source file mode is invalid: ${sourcePath}`);
  }
  return value;
}

function captureSourceFile(repoRoot, sourcePath, reader) {
  const source = requirePhysicalSourceFile(repoRoot, sourcePath, `repository source ${sourcePath}`);
  const content = reader.readBuffer(sourcePath);
  if (!Buffer.isBuffer(content) && !(content instanceof Uint8Array)) {
    throw new Error(`repository source reader returned non-binary content: ${sourcePath}`);
  }
  const after = lstatSync(source.path);
  if (!sameIdentity(source.status, after) || after.nlink !== 1
    || (source.status.mode & 0o777) !== (after.mode & 0o777)) {
    throw new Error(`repository source ${sourcePath} changed identity or mode while it was read`);
  }
  return {
    ...source,
    content: Buffer.from(content),
    mode: sourceMode(reader, sourcePath, after.mode & 0o777),
  };
}

function ensurePrivateParent(root, relativePath) {
  let current = root;
  for (const part of relativePath.split('/').slice(0, -1)) {
    current = resolve(current, part);
    const existing = lstatIfPresent(current);
    if (!existing) {
      mkdirSync(current, { mode: 0o700 });
      chmodSync(current, 0o700);
      const created = lstatSync(current);
      if (created.isSymbolicLink() || !created.isDirectory() || (created.mode & 0o777) !== 0o700) {
        throw new Error(`staged source parent did not retain private mode: ${relativePath}`);
      }
    } else if (existing.isSymbolicLink() || !existing.isDirectory()) {
      throw new Error(`staged source parent is not a physical directory: ${relativePath}`);
    }
  }
}

function writeVerifiedStagedFile(target, content, mode, label) {
  const noFollow = constants.O_NOFOLLOW ?? 0;
  let descriptor;
  try {
    descriptor = openSync(
      target,
      constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | noFollow,
      mode,
    );
    const created = fstatSync(descriptor);
    if (!created.isFile() || created.nlink !== 1) throw new Error(`${label} was not created as a single-link file`);
    fchmodSync(descriptor, mode);
    const modeAdjusted = fstatSync(descriptor);
    if (!sameIdentity(created, modeAdjusted) || (modeAdjusted.mode & 0o777) !== mode) {
      throw new Error(`${label} did not retain its requested mode`);
    }
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    const written = fstatSync(descriptor);
    if (!sameIdentity(modeAdjusted, written) || written.nlink !== 1
      || (written.mode & 0o777) !== mode || written.size !== content.length) {
      throw new Error(`${label} byte count or mode differs from its source`);
    }
    const observed = Buffer.alloc(content.length);
    let offset = 0;
    while (offset < observed.length) {
      const bytesRead = readSync(descriptor, observed, offset, observed.length - offset, offset);
      if (bytesRead <= 0) throw new Error(`${label} could not be read back completely`);
      offset += bytesRead;
    }
    if (!observed.equals(content)) throw new Error(`${label} bytes differ from its source`);
    const confirmed = fstatSync(descriptor);
    const published = lstatSync(target);
    if (!sameIdentity(written, confirmed) || !sameIdentity(written, published)
      || confirmed.nlink !== 1 || published.nlink !== 1
      || confirmed.size !== written.size || published.size !== written.size
      || (confirmed.mode & 0o777) !== mode || (published.mode & 0o777) !== mode) {
      throw new Error(`${label} changed while its bytes and mode were verified`);
    }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function populatePrivateTree(root, records) {
  for (const record of records) {
    ensurePrivateParent(root, record.relativePath);
    const target = resolve(root, ...record.relativePath.split('/'));
    writeVerifiedStagedFile(
      target,
      record.content,
      record.mode,
      `staged source output ${record.relativePath}`,
    );
  }
}

/** Stage only the exact regular-file tree named by a repository source reader. */
export function stageRepositoryTree(repoRoot, prefix, destinationRoot, reader) {
  assertPortableRelativePath(prefix, 'source tree prefix');
  const sourcePath = resolve(repoRoot, ...prefix.split('/'));
  const rootStatus = lstatSync(sourcePath);
  if (rootStatus.isSymbolicLink() || !rootStatus.isDirectory()) throw new Error(`source tree root is not a physical directory: ${prefix}`);
  const realRepo = realpathSync(resolve(repoRoot));
  const realSource = realpathSync(sourcePath);
  if (!isContained(realRepo, realSource) || realRepo === realSource) throw new Error(`source tree root escapes the repository: ${prefix}`);
  const sourceRoot = { path: sourcePath, physicalPath: realSource };
  assertDistinctTreeTarget(sourceRoot, destinationRoot, 'staged source tree destination');

  const manifest = reader.listFiles(prefix);
  const expectedRelative = validateManifest(prefix, manifest);
  const actualRelative = physicalTreeFiles(sourcePath);
  if (JSON.stringify(actualRelative) !== JSON.stringify(expectedRelative)) {
    const expected = new Set(expectedRelative);
    const actual = new Set(actualRelative);
    const extra = actualRelative.filter((path) => !expected.has(path));
    const missing = expectedRelative.filter((path) => !actual.has(path));
    throw new Error(`source tree differs from its Git manifest (${prefix}; extra: ${extra.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'})`);
  }

  const records = manifest.map((sourceFile) => ({
    ...captureSourceFile(repoRoot, sourceFile, reader),
    relativePath: sourceFile.slice(`${prefix}/`.length),
  }));
  const boundary = outputBoundary(destinationRoot, 'staged source tree destination');
  writePhysicalDirectoryAtomically(
    boundary,
    destinationRoot,
    (temporaryRoot) => populatePrivateTree(temporaryRoot, records),
    'staged source tree destination',
  );
  return manifest;
}

/** Overlay one manifest-bound regular source file. */
export function stageRepositoryFile(repoRoot, sourcePath, destinationPath, reader) {
  assertPortableRelativePath(sourcePath, 'source overlay path');
  const manifest = reader.listFiles(sourcePath);
  if (manifest.length !== 1 || manifest[0] !== sourcePath) throw new Error(`source overlay is not one manifest-bound file: ${sourcePath}`);
  const source = captureSourceFile(repoRoot, sourcePath, reader);
  assertDistinctFileTarget(source, destinationPath, 'staged source file destination');
  const boundary = outputBoundary(destinationPath, 'staged source file destination');
  writePhysicalFileAtomically(
    boundary,
    destinationPath,
    source.content,
    'staged source file destination',
    { mode: source.mode },
  );
}

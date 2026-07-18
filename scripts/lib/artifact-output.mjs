/** Safe, atomic writes for caller-selected local artifact paths. */

import {
  closeSync,
  constants,
  fstatSync,
  ftruncateSync,
  fsyncSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import {
  createPhysicalReadBoundary,
  preparePhysicalFileWrite,
  validatePhysicalFileWritePath,
  writePhysicalDirectoryAtomically,
  writePhysicalFileAtomically,
} from './physical-read-boundary.mjs';
import { assertPortableRelativePath, portablePathCollisionKey } from './portable-path.mjs';

export const DEFAULT_REPOSITORY_ARTIFACT_ROOTS = Object.freeze(['.metrics']);

function isContained(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..' && !value.startsWith(`..${sep}`));
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
    if (parent === current) throw new Error(`artifact output has no existing ancestor: ${path}`);
    current = parent;
  }
  return current;
}

function projectedPhysicalPath(path) {
  const ancestor = nearestExisting(path);
  return resolve(realpathSync.native(ancestor), relative(ancestor, resolve(path)));
}

function validateAllowedRepositoryLocation(repositoryRoot, target, allowedRoots, label) {
  const relativeTarget = relative(repositoryRoot, target).split(sep).join('/');
  if (!relativeTarget || relativeTarget === '.') throw new Error(`${label} must not name the repository root`);
  const allowed = allowedRoots.some((root) => relativeTarget.startsWith(`${root}/`));
  if (!allowed) {
    throw new Error(`${label} must be outside the repository or below ${allowedRoots.join(', ')}`);
  }
}

function pathsHaveAncestorConflict(left, right) {
  return left !== right && (isContained(left, right) || isContained(right, left));
}

function portableKeysHaveAncestorConflict(left, right) {
  return left !== right && (left.startsWith(`${right}${sep}`) || right.startsWith(`${left}${sep}`));
}

/**
 * Resolve a caller-selected output without allowing relative traversal or a
 * lexical/physical alias to turn an external-looking path into repository
 * source or Git control data.
 */
export function resolveArtifactOutputPath(
  repositoryRoot,
  requestedPath,
  label = 'artifact output',
  { allowedRepositoryRoots = DEFAULT_REPOSITORY_ARTIFACT_ROOTS, allowExternal = true } = {},
) {
  if (typeof requestedPath !== 'string' || requestedPath.length === 0 || /\p{Cc}/u.test(requestedPath)) {
    throw new Error(`${label} must be a non-empty path without control characters`);
  }
  const repo = resolve(repositoryRoot);
  const hostAbsolute = isAbsolute(requestedPath);
  if (!hostAbsolute && win32.isAbsolute(requestedPath)) {
    throw new Error(`${label} uses an absolute path for a different host platform`);
  }
  const target = hostAbsolute
    ? resolve(requestedPath)
    : resolve(repo, assertPortableRelativePath(requestedPath, label));
  const lexicalInRepository = isContained(repo, target);
  if (lexicalInRepository) validateAllowedRepositoryLocation(repo, target, allowedRepositoryRoots, label);
  else if (!allowExternal) throw new Error(`${label} must remain inside an approved repository artifact root`);

  const repositoryStats = lstatSync(repo);
  if (repositoryStats.isSymbolicLink() || !repositoryStats.isDirectory()) {
    throw new Error(`${label} repository root must be a physical directory`);
  }
  const physicalRepository = realpathSync.native(repo);
  const projected = projectedPhysicalPath(target);
  const physicallyInRepository = isContained(physicalRepository, projected);
  if (lexicalInRepository !== physicallyInRepository) {
    throw new Error(`${label} aliases across the repository boundary`);
  }
  if (physicallyInRepository) {
    validateAllowedRepositoryLocation(physicalRepository, projected, allowedRepositoryRoots, label);
  }
  return target;
}

function outputBoundary(target, label) {
  const parent = nearestExisting(dirname(target));
  const stats = lstatSync(parent);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`${label} nearest existing parent must be a physical directory`);
  }
  return createPhysicalReadBoundary(parent, `${label} boundary`);
}

/** Validate and lease all outputs before the caller performs expensive work. */
export function prepareArtifactOutputPlan(
  repositoryRoot,
  entries,
  {
    allowedRepositoryRoots = DEFAULT_REPOSITORY_ARTIFACT_ROOTS,
    allowExternal = true,
    protectedPaths = [],
    protectedRoots = [],
  } = {},
) {
  const selected = entries.filter((entry) => entry.path != null).map((entry) => ({
    ...entry,
    target: resolveArtifactOutputPath(repositoryRoot, entry.path, entry.label, {
      allowedRepositoryRoots,
      allowExternal,
    }),
  }));
  const protectedLexical = new Set(protectedPaths.map((path) => resolve(path)));
  const protectedPhysical = new Set(protectedPaths.map((path) => projectedPhysicalPath(path)));
  const protectedRootPairs = protectedRoots.map((path) => ({
    lexical: resolve(path),
    physical: projectedPhysicalPath(path),
  }));
  const lexicalTargets = new Set();
  const physicalTargets = new Set();
  const lexicalCollisionKeys = new Set();
  const physicalCollisionKeys = new Set();
  const entryKeys = new Set();
  const priorTargets = [];
  for (const entry of selected) {
    if (typeof entry.key !== 'string' || entry.key.length === 0) {
      throw new Error('artifact output plan requires a stable key');
    }
    if (entryKeys.has(entry.key)) throw new Error(`artifact output plan contains duplicate key: ${entry.key}`);
    const physical = projectedPhysicalPath(entry.target);
    const lexicalCollisionKey = portablePathCollisionKey(entry.target);
    const physicalCollisionKey = portablePathCollisionKey(physical);
    if (lexicalTargets.has(entry.target) || physicalTargets.has(physical)
      || lexicalCollisionKeys.has(lexicalCollisionKey)
      || physicalCollisionKeys.has(physicalCollisionKey)) {
      throw new Error('artifact outputs must not lexically or physically alias one another');
    }
    if (priorTargets.some((prior) => (
      pathsHaveAncestorConflict(prior.target, entry.target)
      || pathsHaveAncestorConflict(prior.physical, physical)
      || portableKeysHaveAncestorConflict(prior.lexicalCollisionKey, lexicalCollisionKey)
      || portableKeysHaveAncestorConflict(prior.physicalCollisionKey, physicalCollisionKey)
    ))) {
      throw new Error('artifact outputs must not have an ancestor or descendant relationship');
    }
    if (protectedLexical.has(entry.target) || protectedPhysical.has(physical)) {
      throw new Error(`${entry.label} must not alias a protected input`);
    }
    if (protectedRootPairs.some((root) => (
      isContained(root.lexical, entry.target) || isContained(root.physical, physical)
    ))) {
      throw new Error(`${entry.label} must not be inside a protected input root`);
    }
    lexicalTargets.add(entry.target);
    physicalTargets.add(physical);
    lexicalCollisionKeys.add(lexicalCollisionKey);
    physicalCollisionKeys.add(physicalCollisionKey);
    entryKeys.add(entry.key);
    entry.physical = physical;
    priorTargets.push({
      target: entry.target,
      physical,
      lexicalCollisionKey,
      physicalCollisionKey,
    });
  }

  const validated = selected.map((entry) => {
    const boundary = outputBoundary(entry.target, entry.label);
    validatePhysicalFileWritePath(boundary, entry.target, entry.label);
    return { entry, boundary };
  });

  /** @type {Record<string, Readonly<{
   * boundary: ReturnType<typeof createPhysicalReadBoundary>,
   * label: string,
   * target: string,
   * physical: string,
   * preparation: ReturnType<typeof preparePhysicalFileWrite>,
   * }>>} */
  const outputs = Object.create(null);
  for (const { entry, boundary } of validated) {
    Object.defineProperty(outputs, entry.key, {
      enumerable: true,
      value: Object.freeze({
        boundary,
        label: entry.label,
        target: entry.target,
        physical: entry.physical,
        preparation: preparePhysicalFileWrite(boundary, entry.target, entry.label),
      }),
    });
  }
  return Object.freeze({ outputs: Object.freeze(outputs) });
}

export function writeArtifactOutput(plan, key, content) {
  if (!plan?.outputs || !Object.hasOwn(plan.outputs, key)) {
    throw new Error(`artifact output plan does not contain ${key}`);
  }
  const output = plan.outputs[key];
  return writePhysicalFileAtomically(
    output.boundary,
    output.target,
    content,
    output.label,
    { preparation: output.preparation },
  );
}

export function writeArtifactFileAtomically(repositoryRoot, path, content, options = {}) {
  const label = options.label ?? 'artifact output';
  const plan = prepareArtifactOutputPlan(repositoryRoot, [{ key: 'output', path, label }], options);
  return writeArtifactOutput(plan, 'output', content);
}

export function writeArtifactDirectoryAtomically(repositoryRoot, path, populate, options = {}) {
  const label = options.label ?? 'artifact directory output';
  const plan = prepareArtifactOutputPlan(repositoryRoot, [{ key: 'output', path, label }], options);
  const output = plan.outputs.output;
  return writePhysicalDirectoryAtomically(
    output.boundary,
    output.target,
    populate,
    label,
    { preparation: output.preparation },
  );
}

/** Append to a pre-existing runner command file without following a link. */
export function appendArtifactFileSafely(repositoryRoot, path, content, options = {}) {
  const label = options.label ?? 'artifact append output';
  const target = resolveArtifactOutputPath(repositoryRoot, path, label, options);
  const before = lstatSync(target);
  if (before.isSymbolicLink() || !before.isFile() || before.nlink !== 1) {
    throw new Error(`${label} must be a physical single-link regular file`);
  }
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const expectedAppend = typeof content === 'string' ? Buffer.from(content, 'utf8') : Buffer.from(content);
  let descriptor;
  let opened;
  try {
    descriptor = openSync(target, constants.O_RDWR | constants.O_APPEND | noFollow);
    opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) {
      throw new Error(`${label} changed identity before it was opened`);
    }
    writeFileSync(descriptor, content);
    fsyncSync(descriptor);
    const appended = fstatSync(descriptor);
    if (!appended.isFile() || appended.nlink !== 1
      || appended.dev !== opened.dev || appended.ino !== opened.ino
      || appended.size !== opened.size + expectedAppend.length) {
      throw new Error(`${label} appended byte count differs from the requested content`);
    }
    const observedAppend = Buffer.alloc(expectedAppend.length);
    let offset = 0;
    while (offset < observedAppend.length) {
      const bytesRead = readSync(
        descriptor,
        observedAppend,
        offset,
        observedAppend.length - offset,
        opened.size + offset,
      );
      if (bytesRead <= 0) throw new Error(`${label} appended bytes could not be read back completely`);
      offset += bytesRead;
    }
    if (!observedAppend.equals(expectedAppend)) {
      throw new Error(`${label} appended bytes differ from the requested content`);
    }
    const confirmed = fstatSync(descriptor);
    const after = lstatSync(target);
    if (!confirmed.isFile() || confirmed.nlink !== 1
      || confirmed.dev !== appended.dev || confirmed.ino !== appended.ino
      || confirmed.size !== appended.size || confirmed.mode !== appended.mode
      || confirmed.mtimeMs !== appended.mtimeMs || confirmed.ctimeMs !== appended.ctimeMs
      || after.isSymbolicLink() || !after.isFile() || after.nlink !== 1
      || after.dev !== appended.dev || after.ino !== appended.ino
      || after.size !== appended.size || after.mode !== appended.mode
      || after.mtimeMs !== appended.mtimeMs || after.ctimeMs !== appended.ctimeMs) {
      throw new Error(`${label} changed identity while it was appended`);
    }
  } catch (error) {
    if (descriptor !== undefined && opened) {
      try {
        ftruncateSync(descriptor, opened.size);
        fsyncSync(descriptor);
        const restoredDescriptor = fstatSync(descriptor);
        const restoredPath = lstatSync(target);
        if (!restoredDescriptor.isFile() || restoredDescriptor.nlink !== 1
          || restoredDescriptor.dev !== opened.dev || restoredDescriptor.ino !== opened.ino
          || restoredDescriptor.size !== opened.size
          || restoredPath.isSymbolicLink() || !restoredPath.isFile() || restoredPath.nlink !== 1
          || restoredPath.dev !== opened.dev || restoredPath.ino !== opened.ino
          || restoredPath.size !== opened.size) {
          throw new Error(`${label} original size or identity was not restored`);
        }
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `${label} append failed and its rollback could not be verified: ${error.message}`,
        );
      }
    }
    throw error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

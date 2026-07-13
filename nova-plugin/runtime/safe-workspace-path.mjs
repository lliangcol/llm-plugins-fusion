import {
  existsSync,
  lstatSync,
  realpathSync,
  statSync,
} from 'node:fs';
import path, { delimiter, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * @typedef {object} WorkspaceTargetOptions
 * @property {string} [filePath]
 * @property {string} [projectRoot]
 * @property {string} [cwd]
 * @property {string[]} [artifactRoots]
 * @property {boolean} [mustExist]
 * @property {boolean} [protectedTarget]
 */

function comparable(value, platform = process.platform) {
  const normalized = resolve(value);
  return platform === 'win32' ? normalized.toLowerCase() : normalized;
}

export function isPathInside(root, target, { platform = process.platform, pathApi = path } = {}) {
  const rootValue = platform === 'win32' ? pathApi.resolve(root).toLowerCase() : pathApi.resolve(root);
  const targetValue = platform === 'win32' ? pathApi.resolve(target).toLowerCase() : pathApi.resolve(target);
  const rel = pathApi.relative(rootValue, targetValue);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(rel));
}

function canonicalAllowedRoot(value, label) {
  const lexical = resolve(value);
  if (!existsSync(lexical)) throw new Error(`${label} does not exist: ${value}`);
  const rootStat = lstatSync(lexical);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`${label} must be a real directory and not a symlink or junction: ${value}`);
  }
  return {
    label,
    lexical,
    real: realpathSync.native(lexical),
    identity: { dev: rootStat.dev, ino: rootStat.ino },
  };
}

export function configuredArtifactRoots(env = process.env) {
  const raw = env.NOVA_EXPLICIT_ARTIFACT_ROOTS ?? env.NOVA_EXPLICIT_ARTIFACT_ROOT ?? '';
  if (!raw) return [];
  if (raw.trim().startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('NOVA_EXPLICIT_ARTIFACT_ROOTS must be a JSON array or path-delimited list');
    }
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string' || !entry)) {
      throw new Error('NOVA_EXPLICIT_ARTIFACT_ROOTS must contain non-empty path strings');
    }
    return parsed;
  }
  return raw.split(delimiter).filter(Boolean);
}

function nearestExistingAncestor(target) {
  let current = target;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) throw new Error(`no existing ancestor for target: ${target}`);
    current = parent;
  }
  return current;
}

function assertExistingComponentsAreReal(root, ancestor) {
  const rel = relative(root, ancestor);
  const parts = rel ? rel.split(sep).filter(Boolean) : [];
  let current = root;
  const rootStat = lstatSync(root);
  if (rootStat.isSymbolicLink()) throw new Error(`allowed root became a symlink or junction: ${root}`);
  for (const part of parts) {
    current = resolve(current, part);
    const currentStat = lstatSync(current);
    if (currentStat.isSymbolicLink()) throw new Error(`path component is a symlink or junction: ${current}`);
  }
}

/** @param {WorkspaceTargetOptions} [options] */
export function resolveWorkspaceTarget({
  filePath,
  projectRoot,
  cwd = projectRoot,
  artifactRoots = [],
  mustExist = false,
  protectedTarget = false,
} = {}) {
  if (typeof filePath !== 'string' || filePath.trim() === '') throw new Error('file path must be a non-empty string');
  if (typeof projectRoot !== 'string' || projectRoot.trim() === '') throw new Error('project root is required');
  const roots = [
    canonicalAllowedRoot(projectRoot, 'project root'),
    ...artifactRoots.map((entry, index) => canonicalAllowedRoot(entry, `artifact root ${index + 1}`)),
  ];
  const base = resolve(cwd || projectRoot);
  const target = isAbsolute(filePath) ? resolve(filePath) : resolve(base, filePath);
  const allowed = roots.find((entry) => isPathInside(entry.lexical, target));
  if (!allowed) throw new Error(`target is outside explicit allowed roots: ${filePath}`);

  const currentRootStat = lstatSync(allowed.lexical);
  if (currentRootStat.dev !== allowed.identity.dev || currentRootStat.ino !== allowed.identity.ino) {
    throw new Error(`allowed root identity changed during validation: ${allowed.lexical}`);
  }
  const ancestor = nearestExistingAncestor(target);
  assertExistingComponentsAreReal(allowed.lexical, ancestor);
  const ancestorReal = realpathSync.native(ancestor);
  if (!isPathInside(allowed.real, ancestorReal)) {
    throw new Error(`target ancestor resolves outside allowed root: ${filePath}`);
  }

  const exists = existsSync(target);
  if (mustExist && !exists) throw new Error(`target does not exist: ${filePath}`);
  /** @type {import('node:fs').Stats | null} */
  let targetStat = null;
  if (exists) {
    targetStat = lstatSync(target);
    if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
      throw new Error(`existing target must be a regular file and not a symlink or junction: ${filePath}`);
    }
    const physicalTarget = realpathSync.native(target);
    if (!isPathInside(allowed.real, physicalTarget)) {
      throw new Error(`existing target resolves outside allowed root: ${filePath}`);
    }
    const links = statSync(target).nlink;
    if (!Number.isInteger(links) || links < 1) {
      throw new Error(`existing write target hard-link semantics are unsupported: ${filePath}`);
    }
    if (links !== 1) {
      throw new Error(`existing write target must have exactly one hard link: ${filePath}`);
    }
  }

  return {
    target,
    exists,
    allowedRoot: allowed.lexical,
    allowedRootReal: allowed.real,
    rootIdentity: allowed.identity,
    targetIdentity: targetStat ? { dev: targetStat.dev, ino: targetStat.ino } : null,
  };
}

export function protectedHooksPaths({ projectRoot, pluginRoot }) {
  return [
    resolve(projectRoot, '.claude/hooks.json'),
    resolve(pluginRoot, 'hooks/hooks.json'),
  ].map((entry) => comparable(entry));
}

export function protectedShellControlPaths({ projectRoot, pluginRoot }) {
  return [
    resolve(projectRoot, '.nova/shell-policy.json'),
    resolve(pluginRoot, 'runtime/shell-command-policy.json'),
    resolve(pluginRoot, 'runtime/safe-workspace-path.mjs'),
    resolve(pluginRoot, 'hooks/scripts/pre-bash-check.mjs'),
    resolve(pluginRoot, 'hooks/scripts/pre-write-check.mjs'),
  ].map((entry) => comparable(entry));
}

export function isProtectedHooksPath(target, options) {
  return protectedHooksPaths(options).includes(comparable(target));
}


export function isProtectedShellControlPath(target, options) {
  return protectedShellControlPaths(options).includes(comparable(target));
}

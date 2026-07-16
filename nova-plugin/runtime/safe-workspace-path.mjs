import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { homedir } from 'node:os';
import path, { basename, delimiter, dirname, isAbsolute, relative, resolve, sep } from 'node:path';

/**
 * @typedef {object} WorkspaceTargetOptions
 * @property {string} [filePath]
 * @property {string} [projectRoot]
 * @property {string} [cwd]
 * @property {string[]} [artifactRoots]
 * @property {boolean} [mustExist]
 * @property {boolean} [protectedTarget]
 */

function comparable(value) {
  // Control paths are ASCII-owned names. Fold them on every platform so the
  // guard remains safe on case-insensitive macOS/Linux volumes as well as
  // Windows. The conservative false positive on a case-sensitive volume is
  // preferable to letting an alias of the same physical control path through.
  return resolve(value).toLowerCase();
}

function comparablePathInside(root, target) {
  const rootValue = comparable(root).replace(/[\\/]+$/u, '');
  const targetValue = comparable(target);
  return targetValue === rootValue || targetValue.startsWith(`${rootValue}${sep}`);
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

const GUARDED_EXECUTABLE_NAMES = Object.freeze([
  'bash',
  'bash.exe',
  'node',
  'node.exe',
  'git',
  'rg',
  'npm',
  'shellcheck',
  'cat',
]);
const SENSITIVE_CONTROL_SEGMENTS = new Set([
  '.git',
  '.claude',
  '.codex',
  '.ssh',
  '.gnupg',
]);

function executableNamesForPlatform(name, env, platform) {
  if (platform !== 'win32' || /\.[A-Za-z0-9]+$/u.test(name)) return [name];
  const extensions = String(env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .filter(Boolean);
  return [name, ...extensions.map((extension) => `${name}${extension.toLowerCase()}`)];
}

export function assertArtifactRootsOutsideExecutableSearch({
  artifactRoots = [],
  cwd = process.cwd(),
  projectRoot = cwd,
  env = process.env,
  executableNames = GUARDED_EXECUTABLE_NAMES,
  platform = process.platform,
} = {}) {
  if (!artifactRoots.length) return [];
  const roots = artifactRoots.map((entry, index) => canonicalAllowedRoot(entry, `artifact root ${index + 1}`));
  const project = resolve(projectRoot);
  const home = resolve(homedir());
  for (const root of roots) {
    if (root.lexical === project) continue;
    if (dirname(root.lexical) === root.lexical) {
      throw new Error(`artifact root must not be a filesystem root: ${root.lexical}`);
    }
    if (isPathInside(root.lexical, home, { platform })) {
      throw new Error(`artifact root must not contain the user home directory: ${root.lexical}`);
    }
    if (root.lexical !== project && isPathInside(root.lexical, project, { platform })) {
      throw new Error(`artifact root must not broaden above the project root: ${root.lexical}`);
    }
    const rootSegments = relative(home, root.lexical).split(sep).filter(Boolean);
    if (isPathInside(home, root.lexical, { platform }) && rootSegments.some((segment) => segment.startsWith('.'))) {
      throw new Error(`artifact root must not be inside a hidden user control directory: ${root.lexical}`);
    }
    if (resolve(root.lexical) !== home && root.lexical.split(/[\\/]/u).some((segment) => SENSITIVE_CONTROL_SEGMENTS.has(segment.toLowerCase()))) {
      throw new Error(`artifact root must not be a security-sensitive control directory: ${root.lexical}`);
    }
  }
  const pathEntries = String(env.PATH ?? '').split(delimiter);
  for (const rawEntry of pathEntries) {
    const lexicalEntry = resolve(cwd, rawEntry || '.');
    let physicalEntry = lexicalEntry;
    try { physicalEntry = realpathSync.native(lexicalEntry); } catch { /* missing PATH entries cannot contain executables yet */ }
    for (const root of roots) {
      if (isPathInside(root.lexical, lexicalEntry, { platform }) || isPathInside(root.real, physicalEntry, { platform })) {
        throw new Error(`artifact root ${root.lexical} contains executable PATH entry ${lexicalEntry}`);
      }
    }
    for (const executable of executableNames) {
      for (const name of executableNamesForPlatform(executable, env, platform)) {
        const candidate = resolve(lexicalEntry, name);
        try {
          if (!statSync(candidate).isFile()) continue;
          accessSync(candidate, constants.X_OK);
          const physicalCandidate = realpathSync.native(candidate);
          for (const root of roots) {
            if (isPathInside(root.lexical, candidate, { platform }) || isPathInside(root.real, physicalCandidate, { platform })) {
              throw new Error(`artifact root ${root.lexical} controls guarded executable ${candidate}`);
            }
          }
        } catch (error) {
          if (error.message?.includes('controls guarded executable')) throw error;
        }
      }
    }
  }
  return roots.map((root) => root.lexical);
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
    resolve(projectRoot, '.claude/settings.json'),
    resolve(projectRoot, '.claude/settings.local.json'),
    resolve(pluginRoot, 'runtime'),
    resolve(pluginRoot, 'hooks/scripts'),
  ].map((entry) => comparable(entry));
}

export function isProtectedHooksPath(target, options) {
  return protectedHooksPaths(options).includes(comparable(target));
}


export function isProtectedShellControlPath(target, options) {
  const targetValue = resolve(target);
  const absoluteSegments = targetValue.split(/[\\/]/u).filter(Boolean);
  if (absoluteSegments.some((segment) => segment.toLowerCase() === '.git')) return true;
  if (isPathInside(options.projectRoot, targetValue)) {
    if (['bash', 'bash.exe'].includes(basename(targetValue).toLowerCase())) return true;
  }
  if ([
    resolve(options.projectRoot, '.nova/shell-policy.json'),
    resolve(options.projectRoot, '.claude/settings.json'),
    resolve(options.projectRoot, '.claude/settings.local.json'),
  ].some((controlPath) => comparable(targetValue) === comparable(controlPath))) return true;
  for (const artifactRoot of options.artifactRoots ?? []) {
    const root = resolve(artifactRoot);
    if (comparable(root) === comparable(options.projectRoot) || !isPathInside(root, targetValue)) continue;
    const segments = relative(root, targetValue).split(sep).filter(Boolean);
    if (segments.some((segment) => SENSITIVE_CONTROL_SEGMENTS.has(segment.toLowerCase()))) return true;
  }
  return [resolve(options.pluginRoot, 'runtime'), resolve(options.pluginRoot, 'hooks/scripts')]
    .some((root) => comparablePathInside(root, targetValue));
}

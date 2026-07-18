import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  readFileSync,
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
const MAX_GIT_POINTER_BYTES = 4096;
const MAX_GIT_CONFIG_BYTES = 1024 * 1024;

function sameFilesystemIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function physicalGitDirectory(candidate, label) {
  const before = lstatSync(candidate, { throwIfNoEntry: false });
  if (!before?.isDirectory() || before.isSymbolicLink()) {
    throw new Error(`${label} must be a real directory and not a symlink or junction`);
  }
  const physical = realpathSync.native(candidate);
  const after = lstatSync(candidate);
  if (!after.isDirectory() || after.isSymbolicLink() || !sameFilesystemIdentity(before, after)
    || realpathSync.native(candidate) !== physical) {
    throw new Error(`${label} changed identity while it was resolved`);
  }
  return { lexical: resolve(candidate), physical };
}

function readGitPointer(path, label, pattern) {
  const before = lstatSync(path, { throwIfNoEntry: false });
  if (!before?.isFile() || before.isSymbolicLink() || before.nlink !== 1) {
    throw new Error(`${label} must be a regular non-symlink file with one hard link`);
  }
  if (before.size > MAX_GIT_POINTER_BYTES) throw new Error(`${label} exceeds the inspection limit`);
  const content = readFileSync(path, 'utf8');
  const after = lstatSync(path);
  if (!after.isFile() || after.isSymbolicLink() || after.nlink !== 1
    || !sameFilesystemIdentity(before, after)) {
    throw new Error(`${label} changed identity while it was read`);
  }
  const match = pattern.exec(content);
  if (!match) throw new Error(`${label} is invalid`);
  return match[1];
}

function isBareGitRepositoryRoot(candidate) {
  const paths = {
    head: resolve(candidate, 'HEAD'),
    config: resolve(candidate, 'config'),
    objects: resolve(candidate, 'objects'),
    refs: resolve(candidate, 'refs'),
  };
  const stats = Object.fromEntries(Object.entries(paths)
    .map(([key, value]) => [key, lstatSync(value, { throwIfNoEntry: false })]));
  if (Object.values(stats).some((value) => !value)) return false;
  if (stats.head.isSymbolicLink() || !stats.head.isFile() || stats.head.nlink !== 1
    || stats.config.isSymbolicLink() || !stats.config.isFile() || stats.config.nlink !== 1
    || stats.objects.isSymbolicLink() || !stats.objects.isDirectory()
    || stats.refs.isSymbolicLink() || !stats.refs.isDirectory()) {
    throw new Error('bare repository control paths must be physical files and directories');
  }
  if (stats.head.size > MAX_GIT_POINTER_BYTES || stats.config.size > MAX_GIT_CONFIG_BYTES) {
    throw new Error('bare repository control metadata exceeds the inspection limit');
  }
  const head = readFileSync(paths.head, 'utf8').trim();
  if (!/^(?:ref:\s+refs\/[A-Za-z0-9._\/-]+|[a-f0-9]{40}|[a-f0-9]{64})$/u.test(head)
    || head.includes('..') || head.includes('//')) {
    throw new Error('bare repository HEAD is invalid');
  }
  return true;
}

/**
 * Resolve the repository and every Git control root discovered from a starting
 * directory. The same strict resolver is shared by the write guard and Bash
 * broker so linked worktrees and bare repositories cannot drift between them.
 */
export function resolveGitControlDirectories(start) {
  let current = physicalGitDirectory(resolve(start), 'Git discovery start').physical;
  while (true) {
    const marker = resolve(current, '.git');
    const markerStats = lstatSync(marker, { throwIfNoEntry: false });
    if (markerStats || isBareGitRepositoryRoot(current)) {
      let gitDirectory;
      if (!markerStats) {
        gitDirectory = physicalGitDirectory(current, 'bare repository Git directory');
      } else if (markerStats.isDirectory() && !markerStats.isSymbolicLink()) {
        gitDirectory = physicalGitDirectory(marker, 'repository .git directory');
      } else if (markerStats.isFile() && !markerStats.isSymbolicLink()) {
        const pointer = readGitPointer(
          marker,
          'repository .git pointer',
          /^gitdir: ([^\r\n\0]+)(?:\r?\n)?$/iu,
        );
        gitDirectory = physicalGitDirectory(resolve(dirname(marker), pointer), 'repository gitdir');
      } else {
        throw new Error('repository .git marker must be a physical file or directory');
      }

      const commonMarker = resolve(gitDirectory.lexical, 'commondir');
      const commonStats = lstatSync(commonMarker, { throwIfNoEntry: false });
      let commonDirectory = gitDirectory;
      if (commonStats) {
        const pointer = readGitPointer(
          commonMarker,
          'repository commondir pointer',
          /^([^\r\n\0]+)(?:\r?\n)?$/u,
        );
        commonDirectory = physicalGitDirectory(resolve(gitDirectory.lexical, pointer), 'repository common gitdir');
      }
      return Object.freeze({
        repositoryRoot: current,
        gitDir: gitDirectory.physical,
        gitDirLexical: gitDirectory.lexical,
        commonDir: commonDirectory.physical,
        commonDirLexical: commonDirectory.lexical,
      });
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function pathsOverlap(left, right, platform) {
  return isPathInside(left, right, { platform }) || isPathInside(right, left, { platform });
}

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
  const gitControls = resolveGitControlDirectories(project);
  const gitControlRoots = gitControls
    ? [...new Set([
      gitControls.gitDirLexical,
      gitControls.gitDir,
      gitControls.commonDirLexical,
      gitControls.commonDir,
    ])]
    : [];
  for (const root of roots) {
    for (const controlRoot of gitControlRoots) {
      if (pathsOverlap(root.lexical, controlRoot, platform)
        || pathsOverlap(root.real, controlRoot, platform)) {
        throw new Error(`artifact root ${root.lexical} overlaps Git control directory ${controlRoot}`);
      }
    }
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
  let physicalTargetValue = targetValue;
  try {
    const ancestor = nearestExistingAncestor(targetValue);
    physicalTargetValue = resolve(realpathSync.native(ancestor), relative(ancestor, targetValue));
  } catch {
    // The lexical decision below remains fail-closed for named control paths.
  }
  const absoluteSegments = targetValue.split(/[\\/]/u).filter(Boolean);
  if (absoluteSegments.some((segment) => segment.toLowerCase() === '.git')) return true;
  try {
    const gitControls = resolveGitControlDirectories(options.projectRoot);
    if (gitControls && [
      gitControls.gitDirLexical,
      gitControls.gitDir,
      gitControls.commonDirLexical,
      gitControls.commonDir,
    ].some((root) => comparablePathInside(root, targetValue)
      || comparablePathInside(root, physicalTargetValue))) return true;
  } catch {
    // Malformed or unstable Git metadata invalidates the write trust boundary.
    return true;
  }
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

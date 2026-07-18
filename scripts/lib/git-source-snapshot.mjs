import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { accessSync, closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from 'node:fs';
import { devNull } from 'node:os';
import { delimiter, dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { TextDecoder } from 'node:util';
import { assertPortableRelativePath } from './portable-path.mjs';

const bufferCache = new Map();
const fatalUtf8Decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function directoryState(stat, label) {
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`${label} must remain a physical directory`);
  }
  return Object.freeze({
    dev: stat.dev,
    ino: stat.ino,
    nlink: stat.nlink,
    mode: stat.mode,
    size: stat.size,
    mtimeNs: stat.mtimeNs,
    ctimeNs: stat.ctimeNs,
  });
}

function sameDirectoryState(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.nlink === right.nlink
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function sameDirectoryIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

function captureRepositoryRoot(repoRoot) {
  const lexicalRoot = resolve(repoRoot);
  const before = directoryState(lstatSync(lexicalRoot, { bigint: true }), 'repository root');
  const physicalRoot = realpathSync.native(lexicalRoot);
  const after = directoryState(lstatSync(lexicalRoot, { bigint: true }), 'repository root');
  if (!sameDirectoryState(before, after) || realpathSync.native(lexicalRoot) !== physicalRoot) {
    throw new Error('repository root changed identity while it was inspected');
  }
  return Object.freeze({
    lexicalRoot,
    physicalRoot,
    identity: after,
    cacheKey: `${physicalRoot}\0${after.dev}\0${after.ino}`,
  });
}

function verifyRepositoryRoot(root) {
  const current = directoryState(lstatSync(root.lexicalRoot, { bigint: true }), 'repository root');
  if (!sameDirectoryIdentity(current, root.identity)
    || realpathSync.native(root.lexicalRoot) !== root.physicalRoot) {
    throw new Error('repository root changed identity while it was in use');
  }
}

// Keep a directory descriptor across each Git/read operation and compare its
// nanosecond state with the path before and after use. Node has no portable
// descriptor-relative cwd/openat API, so unusual same-UID filesystems that do
// not expose rename metadata remain a documented residual limitation.
function openRepositoryRootLease(root) {
  verifyRepositoryRoot(root);
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const directoryOnly = constants.O_DIRECTORY ?? 0;
  let descriptor;
  try {
    descriptor = openSync(root.physicalRoot, constants.O_RDONLY | directoryOnly | noFollow);
  } catch (error) {
    if (process.platform !== 'win32' || !['EACCES', 'EINVAL', 'EISDIR', 'EPERM'].includes(error?.code)) throw error;
  }
  const beforePath = directoryState(lstatSync(root.physicalRoot, { bigint: true }), 'repository root');
  const beforeDescriptor = descriptor === undefined
    ? beforePath
    : directoryState(fstatSync(descriptor, { bigint: true }), 'repository root descriptor');
  if (!sameDirectoryState(beforePath, beforeDescriptor)
    || !sameDirectoryIdentity(beforeDescriptor, root.identity)) {
    if (descriptor !== undefined) closeSync(descriptor);
    throw new Error('repository root changed identity while its operation lease was opened');
  }
  return { descriptor, before: beforeDescriptor };
}

function closeRepositoryRootLease(root, lease) {
  try {
    const afterPath = directoryState(lstatSync(root.physicalRoot, { bigint: true }), 'repository root');
    const afterDescriptor = lease.descriptor === undefined
      ? afterPath
      : directoryState(fstatSync(lease.descriptor, { bigint: true }), 'repository root descriptor');
    if (!sameDirectoryState(lease.before, afterDescriptor)
      || !sameDirectoryState(afterDescriptor, afterPath)
      || realpathSync.native(root.lexicalRoot) !== root.physicalRoot) {
      throw new Error('repository root changed identity or metadata while it was in use');
    }
  } finally {
    if (lease.descriptor !== undefined) closeSync(lease.descriptor);
  }
}

function decodeUtf8(buffer, path) {
  try {
    return fatalUtf8Decoder.decode(buffer);
  } catch (error) {
    throw new Error(`Git source path is not valid UTF-8: ${path}`, { cause: error });
  }
}

function pathInside(root, path) {
  const value = relative(root, path);
  return value === '' || (!isAbsolute(value) && value !== '..' && !value.startsWith(`..${sep}`));
}

function captureGitExecutable(path, workspace) {
  const physical = realpathSync.native(path);
  if (pathInside(workspace, physical)) throw new Error('trusted Git executable must resolve outside the repository workspace');
  const before = lstatSync(physical);
  if (before.isSymbolicLink() || !before.isFile() || before.nlink !== 1) {
    throw new Error('trusted Git executable must be a single-link physical regular file');
  }
  accessSync(physical, constants.X_OK);
  const after = lstatSync(physical);
  if (!sameStableFile(before, after)) throw new Error('trusted Git executable changed identity while it was inspected');
  return Object.freeze({
    command: physical,
    directory: dirname(physical),
    identity: Object.freeze({
      dev: after.dev,
      ino: after.ino,
      mode: after.mode,
      nlink: after.nlink,
      size: after.size,
      mtimeMs: after.mtimeMs,
      ctimeMs: after.ctimeMs,
    }),
  });
}

function verifyGitExecutable(invocation) {
  const current = lstatSync(invocation.command);
  if (current.isSymbolicLink() || !current.isFile() || current.nlink !== 1
    || current.dev !== invocation.identity.dev
    || current.ino !== invocation.identity.ino
    || current.mode !== invocation.identity.mode
    || current.size !== invocation.identity.size
    || current.mtimeMs !== invocation.identity.mtimeMs
    || current.ctimeMs !== invocation.identity.ctimeMs) {
    throw new Error('trusted Git executable changed identity while it was in use');
  }
}

function resolveTrustedGit(root, environment = process.env) {
  verifyRepositoryRoot(root);
  const workspace = root.physicalRoot;
  const fixedCandidates = process.platform === 'win32'
    ? [
        environment.ProgramFiles ? resolve(environment.ProgramFiles, 'Git/cmd/git.exe') : null,
        environment.ProgramFiles ? resolve(environment.ProgramFiles, 'Git/bin/git.exe') : null,
        environment.LOCALAPPDATA ? resolve(environment.LOCALAPPDATA, 'Programs/Git/cmd/git.exe') : null,
      ]
    : ['/usr/bin/git', '/bin/git'];
  const executableName = process.platform === 'win32' ? 'git.exe' : 'git';
  const pathCandidates = String(environment.PATH ?? environment.Path ?? '')
    .split(delimiter)
    .filter((entry) => entry && isAbsolute(entry))
    .map((entry) => resolve(entry, executableName));
  for (const candidate of [...fixedCandidates, ...pathCandidates]) {
    if (!candidate) continue;
    try {
      return captureGitExecutable(candidate, workspace);
    } catch (error) {
      if (['EACCES', 'ENOENT', 'ENOTDIR'].includes(error?.code)
        || /outside the repository workspace|single-link physical regular file/u.test(error?.message ?? '')) continue;
      throw error;
    }
  }
  throw new Error('Git is unavailable on the trusted executable path');
}

export function trustedGitEnvironment(invocation) {
  // Do not inherit caller-controlled process, shell, dynamic-loader, pager, or
  // helper configuration. These source reads need only local Git plumbing, so
  // every child variable can be authored here.
  return {
    GIT_NO_REPLACE_OBJECTS: '1',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: devNull,
    LANG: 'C',
    LC_ALL: 'C',
    PATH: invocation.directory,
  };
}

function trustedGit(root, args, {
  encoding = 'utf8',
  input = undefined,
  maxBuffer = 16 * 1024 * 1024,
} = {}) {
  const lease = openRepositoryRootLease(root);
  try {
    const invocation = resolveTrustedGit(root);
    verifyGitExecutable(invocation);
    const gitArgs = [
      '--no-replace-objects',
      `--work-tree=${root.physicalRoot}`,
      '-c',
      'core.fsmonitor=false',
      '-c',
      `core.excludesFile=${devNull}`,
      ...args,
    ];
    const options = {
      cwd: root.physicalRoot,
      env: trustedGitEnvironment(invocation),
      input,
      shell: false,
      maxBuffer,
    };
    const observed = encoding === null
      ? spawnSync(invocation.command, gitArgs, { ...options, encoding: null })
      : spawnSync(invocation.command, gitArgs, {
          ...options,
          encoding: /** @type {BufferEncoding | 'buffer'} */ (encoding),
        });
    verifyGitExecutable(invocation);
    return observed;
  } finally {
    closeRepositoryRootLease(root, lease);
  }
}

function gitOutput(root, args) {
  const observed = trustedGit(root, args);
  if (observed.status !== 0) {
    throw new Error(`Git source inventory failed: ${String(observed.stderr ?? '').trim() || args.join(' ')}`);
  }
  return String(observed.stdout ?? '');
}

function validateSourcePath(path) {
  assertPortableRelativePath(path, 'Git source path');
  return path;
}

function validateSourcePrefix(prefix) {
  if (prefix === '') return prefix;
  return validateSourcePath(prefix);
}

function validateGitRevision(revision, label = 'Git revision') {
  if (typeof revision !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9._/@{}+~^-]*$/u.test(revision)) {
    throw new Error(`${label} must be a non-option ref or object expression`);
  }
  return revision;
}

function prefetchSnapshotBuffers(root, commit, paths) {
  const missing = paths.filter((path) => !bufferCache.has(`${root.cacheKey}\0${commit}\0${path}`));
  if (missing.length === 0) return;
  const observed = trustedGit(root, ['cat-file', '--batch'], {
    input: Buffer.from(`${missing.map((path) => `${commit}:${path}`).join('\n')}\n`),
    encoding: null,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (observed.status !== 0) throw new Error(`source snapshot batch read failed: ${String(observed.stderr ?? '').trim()}`);
  const stdout = Buffer.isBuffer(observed.stdout) ? observed.stdout : Buffer.from(observed.stdout);
  let offset = 0;
  for (const path of missing) {
    const headerEnd = stdout.indexOf(0x0a, offset);
    if (headerEnd < 0) throw new Error(`source snapshot batch response is truncated for ${path}`);
    const header = stdout.subarray(offset, headerEnd).toString('utf8');
    const match = header.match(/^[a-f0-9]+ blob (\d+)$/u);
    if (!match) throw new Error(`source snapshot batch response is invalid for ${path}`);
    const size = Number.parseInt(match[1], 10);
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    if (contentEnd >= stdout.length || stdout[contentEnd] !== 0x0a) {
      throw new Error(`source snapshot batch content is truncated for ${path}`);
    }
    bufferCache.set(`${root.cacheKey}\0${commit}\0${path}`, Buffer.from(stdout.subarray(contentStart, contentEnd)));
    offset = contentEnd + 1;
  }
}

function sameStableFile(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.nlink === right.nlink
    && (left.mode & 0o777) === (right.mode & 0o777)
    && left.mtimeMs === right.mtimeMs
    && left.ctimeMs === right.ctimeMs;
}

function requireSingleLinkRegularFile(status, path) {
  if (status.isSymbolicLink() || !status.isFile()) throw new Error(`Git source path is not a physical regular file: ${path}`);
  if (status.nlink !== 1) throw new Error(`Git source path must not be hard linked: ${path}`);
}

function readPhysicalWorktreeFile(root, path) {
  validateSourcePath(path);
  const rootLease = openRepositoryRootLease(root);
  let descriptor;
  try {
    let cursor = root.physicalRoot;
    const components = path.split('/');
    for (const [index, component] of components.entries()) {
      cursor = resolve(cursor, component);
      const status = lstatSync(cursor);
      if (status.isSymbolicLink()) throw new Error(`Git source path contains a symbolic link: ${path}`);
      if (index < components.length - 1 && !status.isDirectory()) throw new Error(`Git source path parent is not a directory: ${path}`);
    }
    const target = realpathSync(cursor);
    if (target !== root.physicalRoot && !target.startsWith(`${root.physicalRoot}${sep}`)) {
      throw new Error(`Git source path escapes the repository: ${path}`);
    }
    const before = lstatSync(cursor);
    requireSingleLinkRegularFile(before, path);
    const noFollow = constants.O_NOFOLLOW ?? 0;
    descriptor = openSync(cursor, constants.O_RDONLY | noFollow);
    const opened = fstatSync(descriptor);
    requireSingleLinkRegularFile(opened, path);
    if (!sameStableFile(before, opened)) throw new Error(`Git source path changed identity before it was opened: ${path}`);
    const buffer = readFileSync(descriptor);
    const afterRead = fstatSync(descriptor);
    requireSingleLinkRegularFile(afterRead, path);
    if (!sameStableFile(opened, afterRead) || buffer.length !== afterRead.size) {
      throw new Error(`Git source path changed identity while it was read: ${path}`);
    }
    const afterPath = lstatSync(cursor);
    requireSingleLinkRegularFile(afterPath, path);
    if (!sameStableFile(afterRead, afterPath)
      || realpathSync(cursor) !== target
      || (target !== root.physicalRoot && !target.startsWith(`${root.physicalRoot}${sep}`))) {
      throw new Error(`Git source path changed identity after it was read: ${path}`);
    }
    return Object.freeze({ buffer, mode: afterRead.mode & 0o777 });
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    closeRepositoryRootLease(root, rootLease);
  }
}

function worktreeManifest(root, prefix, cache) {
  validateSourcePrefix(prefix);
  const cacheKey = `${root.cacheKey}\0worktree\0${prefix}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const args = [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-per-directory=.gitignore',
  ];
  if (prefix !== '') args.push('--', prefix);
  const output = gitOutput(root, args);
  const paths = output.split('\0').filter(Boolean).map(validateSourcePath).sort();
  cache.set(cacheKey, paths);
  return paths;
}

/** Capture repository files from one deterministic Git worktree manifest. */
export function gitWorktreeSourceReader(repoRoot) {
  const root = captureRepositoryRoot(repoRoot);
  const records = new Map();
  // Worktree manifests are intentionally scoped to one reader. A later reader
  // in the same process must observe newly added or removed source files.
  const manifests = new Map();
  const record = (path) => {
    if (!records.has(path)) records.set(path, readPhysicalWorktreeFile(root, path));
    return records.get(path);
  };
  const internalBuffer = (path) => record(path).buffer;
  const readBuffer = (path) => Buffer.from(internalBuffer(path));
  return {
    readBuffer,
    readText: (path) => decodeUtf8(internalBuffer(path), path),
    readJson: (path) => JSON.parse(decodeUtf8(internalBuffer(path), path)),
    sha256: (path) => createHash('sha256').update(internalBuffer(path)).digest('hex'),
    listFiles: (prefix) => [...worktreeManifest(root, prefix, manifests)],
    fileMode: (path) => record(path).mode,
  };
}

export function gitHead(repoRoot) {
  const root = captureRepositoryRoot(repoRoot);
  const observed = trustedGit(root, ['rev-parse', '--verify', 'HEAD^{commit}']);
  const stdout = String(observed.stdout ?? '').trim();
  if (observed.status !== 0 || !/^[a-f0-9]{40}$/u.test(stdout)) {
    throw new Error('repository HEAD could not be resolved');
  }
  return stdout;
}

/** Resolve one safe ref or object expression to an exact commit id. */
export function gitResolveCommit(repoRoot, revision) {
  const root = captureRepositoryRoot(repoRoot);
  const value = validateGitRevision(revision);
  const observed = trustedGit(root, ['rev-parse', '--verify', `${value}^{commit}`]);
  const stdout = String(observed.stdout ?? '').trim();
  if (observed.status !== 0 || !/^[a-f0-9]{40}$/u.test(stdout)) {
    throw new Error(`Git revision could not be resolved to an exact commit: ${value}`);
  }
  return stdout;
}

/** Test commit ancestry without inheriting caller Git configuration. */
export function gitIsAncestor(repoRoot, ancestor, descendant = 'HEAD') {
  const root = captureRepositoryRoot(repoRoot);
  const left = validateGitRevision(ancestor, 'Git ancestor revision');
  const right = validateGitRevision(descendant, 'Git descendant revision');
  const observed = trustedGit(root, ['merge-base', '--is-ancestor', left, right]);
  if (observed.status === 0) return true;
  if (observed.status === 1) return false;
  throw new Error(`Git ancestry could not be established: ${String(observed.stderr ?? '').trim() || `${left} -> ${right}`}`);
}

/** Return the exact tag on a revision, or null when the revision is untagged. */
export function gitExactTag(repoRoot, revision = 'HEAD') {
  const root = captureRepositoryRoot(repoRoot);
  const value = validateGitRevision(revision);
  const commit = gitResolveCommit(repoRoot, value);
  const listed = trustedGit(root, ['tag', '--points-at', commit]);
  if (listed.status !== 0) {
    throw new Error(`Git exact-tag inventory failed: ${String(listed.stderr ?? '').trim() || commit}`);
  }
  const exactTags = String(listed.stdout ?? '').split(/\r?\n/u).filter(Boolean);
  for (const tag of exactTags) {
    if (/\0|\r|\n/u.test(tag)) throw new Error('Git exact tag output is malformed');
  }
  if (exactTags.length === 0) return null;

  const observed = trustedGit(root, ['describe', '--tags', '--exact-match', commit]);
  if (observed.status !== 0) {
    throw new Error(`Git exact tag could not be selected: ${String(observed.stderr ?? '').trim() || commit}`);
  }
  const tag = String(observed.stdout ?? '').trim();
  if (!tag || /[\0\r\n]/u.test(tag) || !exactTags.includes(tag)) {
    throw new Error('Git exact tag output is malformed');
  }
  return tag;
}

/** Return the committer timestamp for one exact revision. */
export function gitCommitTimestamp(repoRoot, revision = 'HEAD') {
  const root = captureRepositoryRoot(repoRoot);
  const value = validateGitRevision(revision);
  const observed = trustedGit(root, ['show', '-s', '--format=%cI', value, '--']);
  const timestamp = String(observed.stdout ?? '').trim();
  if (observed.status !== 0 || !Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`Git commit timestamp could not be resolved: ${value}`);
  }
  return timestamp;
}

/**
 * List tracked index paths without inheriting repository redirects or Git
 * configuration from the caller.
 *
 * @param {string} repoRoot
 * @param {{deleted?: boolean, pathPrefix?: string | null}} [options]
 */
export function gitTrackedFiles(repoRoot, { deleted = false, pathPrefix = null } = {}) {
  const root = captureRepositoryRoot(repoRoot);
  const args = ['ls-files', '-z'];
  if (deleted) args.push('--deleted');
  if (pathPrefix !== null) args.push('--', validateSourcePath(pathPrefix));
  const observed = trustedGit(root, args);
  if (observed.status !== 0) {
    throw new Error(`Git tracked-file inventory failed: ${String(observed.stderr ?? '').trim() || args.join(' ')}`);
  }
  return String(observed.stdout ?? '').split('\0').filter(Boolean).map(validateSourcePath).sort();
}

/** List untracked, non-ignored worktree paths through the trusted Git boundary. */
export function gitUntrackedFiles(repoRoot) {
  const root = captureRepositoryRoot(repoRoot);
  const observed = trustedGit(root, ['ls-files', '-z', '--others', '--exclude-standard']);
  if (observed.status !== 0) {
    throw new Error(`Git untracked-file inventory failed: ${String(observed.stderr ?? '').trim() || 'ls-files --others'}`);
  }
  return String(observed.stdout ?? '').split('\0').filter(Boolean).map(validateSourcePath).sort();
}

/** List paths changed since one non-option Git revision. */
export function gitChangedFiles(repoRoot, revision) {
  validateGitRevision(revision, 'Git comparison revision');
  const root = captureRepositoryRoot(repoRoot);
  const observed = trustedGit(root, [
    'diff', '--name-only', '-z', '--diff-filter=ACDMRTUXB', '--no-ext-diff', '--no-textconv',
    '--ignore-submodules=all', revision, '--',
  ]);
  if (observed.status !== 0) {
    throw new Error(`Git changed-file inventory failed: ${String(observed.stderr ?? '').trim() || revision}`);
  }
  return String(observed.stdout ?? '').split('\0').filter(Boolean).map(validateSourcePath).sort();
}

export function assertNoHiddenGitIndexFlags(repoRoot, observed = undefined) {
  if (observed === undefined) {
    const root = captureRepositoryRoot(repoRoot);
    observed = trustedGit(root, ['ls-files', '-v', '-z']);
  }
  if (observed?.status !== 0) throw new Error('Git hidden-index flags could not be inspected');
  const hidden = String(observed.stdout ?? '').split('\0').filter((entry) => /^[a-zS] /u.test(entry));
  if (hidden.length > 0) {
    throw new Error(`Git skip-worktree or assume-unchanged flags are forbidden for governed snapshot verification (${hidden.length} path${hidden.length === 1 ? '' : 's'})`);
  }
}

export function localModuleClosure(entryPath, readText) {
  const pending = [validateSourcePath(entryPath)];
  const seen = new Set();
  while (pending.length > 0) {
    const path = pending.pop();
    if (seen.has(path)) continue;
    seen.add(path);
    const source = readText(path);
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/gu)) {
      let dependency = posix.normalize(posix.join(posix.dirname(path), match[1]));
      if (!posix.extname(dependency)) dependency = `${dependency}.mjs`;
      pending.push(validateSourcePath(dependency));
    }
  }
  return [...seen].sort();
}

export function assertWorktreeMatchesSnapshot(repoRoot, snapshot, paths, label = 'governed source', {
  worktreeReader = gitWorktreeSourceReader(repoRoot),
  compareMode = process.platform !== 'win32',
} = {}) {
  for (const path of paths) {
    const expected = snapshot.readBuffer(path);
    const observed = worktreeReader.readBuffer(path);
    if (!Buffer.from(observed).equals(Buffer.from(expected))
      || (compareMode && worktreeReader.fileMode(path) !== snapshot.fileMode(path))) {
      throw new Error(`${label} differs between the physical worktree and the selected Git snapshot: ${path}`);
    }
  }
}

function headTreeManifest(root, commit) {
  const output = gitOutput(root, ['ls-tree', '-r', '-z', '--full-tree', commit]);
  return output.split('\0').filter(Boolean).map((entry) => {
    const match = entry.match(/^(\d{6}) (blob|commit) ([a-f0-9]+)\t([^\0]+)$/u);
    if (!match) throw new Error('repository HEAD tree entry is malformed');
    const [, mode, type, object, path] = match;
    validateSourcePath(path);
    if (type !== 'blob' || !['100644', '100755'].includes(mode)) {
      throw new Error(`repository HEAD contains a symbolic link or non-regular entry: ${path}`);
    }
    return `${mode} ${object} 0\t${path}`;
  }).sort();
}

function indexManifest(root) {
  const output = gitOutput(root, ['ls-files', '--stage', '-z']);
  return output.split('\0').filter(Boolean).map((entry) => {
    const match = entry.match(/^(\d{6}) ([a-f0-9]+) ([0-3])\t([^\0]+)$/u);
    if (!match) throw new Error('repository index entry is malformed');
    const [, mode, object, stage, path] = match;
    validateSourcePath(path);
    if (stage !== '0') throw new Error(`repository index contains an unresolved merge entry: ${path}`);
    if (!['100644', '100755'].includes(mode)) {
      throw new Error(`repository index contains a symbolic link or non-regular entry: ${path}`);
    }
    return `${mode} ${object} ${stage}\t${path}`;
  }).sort();
}

function sameManifest(left, right) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

/**
 * Require HEAD, the index, and physical non-ignored worktree state to describe
 * one exact commit without trusting caller Git redirects, status filters, or
 * hidden index flags. Returns the verified commit id.
 */
export function assertCleanGitRepository(repoRoot, expectedCommit = undefined) {
  const initialHead = gitHead(repoRoot);
  if (expectedCommit !== undefined
    && (!/^[a-f0-9]{40}$/u.test(expectedCommit) || initialHead !== expectedCommit)) {
    throw new Error('repository HEAD differs from the expected clean commit');
  }
  const commit = expectedCommit ?? initialHead;
  const root = captureRepositoryRoot(repoRoot);
  const expectedIndex = headTreeManifest(root, commit);
  const initialIndex = indexManifest(root);
  if (!sameManifest(initialIndex, expectedIndex)) {
    throw new Error('repository index differs from the clean HEAD tree');
  }
  assertNoHiddenGitIndexFlags(repoRoot);
  const initialUntracked = gitUntrackedFiles(repoRoot);
  if (initialUntracked.length > 0) {
    throw new Error(`repository has untracked non-ignored worktree paths (${initialUntracked.length})`);
  }

  const snapshot = gitSnapshotReader(repoRoot, commit);
  const paths = snapshot.listFiles('');
  assertWorktreeMatchesSnapshot(repoRoot, snapshot, paths, 'clean repository');

  const finalIndex = indexManifest(root);
  const finalUntracked = gitUntrackedFiles(repoRoot);
  if (!sameManifest(finalIndex, initialIndex)
    || !sameManifest(finalUntracked, initialUntracked)
    || gitHead(repoRoot) !== commit) {
    throw new Error('repository state changed while cleanliness was verified');
  }
  return commit;
}

export function gitSnapshotReader(repoRoot, commit) {
  if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error('source snapshot commit must be a lowercase 40-character Git object id');
  const root = captureRepositoryRoot(repoRoot);
  const objectType = trustedGit(root, ['cat-file', '-t', commit]);
  if (objectType.status !== 0 || String(objectType.stdout ?? '').trim() !== 'commit') {
    throw new Error('source snapshot object must resolve to an exact commit object');
  }
  const manifests = new Map();
  const modes = new Map();
  const listFiles = (prefix) => {
    validateSourcePrefix(prefix);
    const cacheKey = `${root.cacheKey}\0${commit}\0tree\0${prefix}`;
    if (manifests.has(cacheKey)) return [...manifests.get(cacheKey)];
    const args = ['ls-tree', '-r', '-z', commit];
    if (prefix !== '') args.push('--', prefix);
    const output = gitOutput(root, args);
    const paths = output.split('\0').filter(Boolean).map((entry) => {
      const match = entry.match(/^(\d{6}) (blob|commit) [a-f0-9]+\t(.+)$/u);
      if (!match) throw new Error(`source snapshot tree entry is malformed under ${prefix}`);
      const [, mode, type, path] = match;
      if (type !== 'blob' || !['100644', '100755'].includes(mode)) {
        throw new Error(`source snapshot contains a symbolic link or non-regular entry: ${path}`);
      }
      modes.set(path, Number.parseInt(mode.slice(-3), 8));
      return validateSourcePath(path);
    }).sort();
    prefetchSnapshotBuffers(root, commit, paths);
    manifests.set(cacheKey, paths);
    return [...paths];
  };
  const fileMode = (path) => {
    validateSourcePath(path);
    if (!modes.has(path)) {
      const entries = listFiles(path);
      if (entries.length !== 1 || entries[0] !== path) throw new Error(`source snapshot is missing ${path}`);
    }
    return modes.get(path);
  };
  const internalBuffer = (path) => {
    validateSourcePath(path);
    // Every content access is mode-gated first. Direct callers must not be
    // able to read symlink blobs or gitlinks without going through listFiles.
    fileMode(path);
    const cacheKey = `${root.cacheKey}\0${commit}\0${path}`;
    const cached = bufferCache.get(cacheKey);
    if (cached) return cached;
    const observed = trustedGit(root, ['show', `${commit}:${path}`], {
      encoding: null,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (observed.status !== 0) throw new Error(`source snapshot is missing ${path}`);
    const buffer = Buffer.from(observed.stdout);
    bufferCache.set(cacheKey, buffer);
    return buffer;
  };
  const readBuffer = (path) => Buffer.from(internalBuffer(path));
  return {
    readBuffer,
    readText: (path) => decodeUtf8(internalBuffer(path), path),
    readJson: (path) => JSON.parse(decodeUtf8(internalBuffer(path), path)),
    sha256: (path) => createHash('sha256').update(internalBuffer(path)).digest('hex'),
    listFiles,
    fileMode,
  };
}

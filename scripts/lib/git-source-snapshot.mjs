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

function trustedGitEnvironment(invocation, source = process.env) {
  const environment = {};
  for (const [key, value] of Object.entries(source)) {
    if (!key.toUpperCase().startsWith('GIT_')
      && key.toUpperCase() !== 'PATH'
      && value !== undefined) environment[key] = value;
  }
  // These values are authored here rather than inherited from the caller.
  environment.GIT_NO_REPLACE_OBJECTS = '1';
  environment.GIT_OPTIONAL_LOCKS = '0';
  environment.GIT_TERMINAL_PROMPT = '0';
  environment.GIT_CONFIG_NOSYSTEM = '1';
  environment.GIT_CONFIG_GLOBAL = devNull;
  environment.PATH = invocation.directory;
  return environment;
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
  validateSourcePath(prefix);
  const cacheKey = `${root.cacheKey}\0worktree\0${prefix}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const output = gitOutput(root, [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-per-directory=.gitignore',
    '--',
    prefix,
  ]);
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
} = {}) {
  for (const path of paths) {
    const expected = snapshot.readBuffer(path);
    const observed = worktreeReader.readBuffer(path);
    if (!Buffer.from(observed).equals(Buffer.from(expected))
      || worktreeReader.fileMode(path) !== snapshot.fileMode(path)) {
      throw new Error(`${label} differs between the physical worktree and the selected Git snapshot: ${path}`);
    }
  }
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
    validateSourcePath(prefix);
    const cacheKey = `${root.cacheKey}\0${commit}\0tree\0${prefix}`;
    if (manifests.has(cacheKey)) return [...manifests.get(cacheKey)];
    const output = gitOutput(root, ['ls-tree', '-r', '-z', commit, '--', prefix]);
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

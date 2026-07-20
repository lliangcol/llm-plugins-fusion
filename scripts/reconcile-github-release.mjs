#!/usr/bin/env node
/** Reconcile a draft GitHub Release without overwriting conflicting assets. */

import {
  accessSync,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, win32 } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { reconcileReleaseAssets } from './lib/release-state-machine.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';
import { createPhysicalReadBoundary, readPhysicalDirectory, readPhysicalFile } from './lib/physical-read-boundary.mjs';
import { assertPortableRelativePath, comparePortablePaths, portablePathCollisionKey } from './lib/portable-path.mjs';

const githubRepositoryPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/u;
const stableTagPattern = /^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const candidateTagPattern = /^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)-rc\.(?:0|[1-9][0-9]*)$/u;
const githubReleaseTimeoutMs = 120_000;
const githubReleaseMaxBuffer = 1024 * 1024;
const networkEnvironmentKeys = Object.freeze([
  'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY',
  'https_proxy', 'http_proxy', 'all_proxy', 'no_proxy',
  'SSL_CERT_FILE', 'SSL_CERT_DIR',
]);

function pathInside(root, path) {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function executableIdentity(path) {
  const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const stats = fstatSync(descriptor);
    const afterOpen = lstatSync(path);
    if (!stats.isFile() || stats.nlink !== 1 || afterOpen.isSymbolicLink()
      || afterOpen.dev !== stats.dev || afterOpen.ino !== stats.ino) {
      throw new Error('GitHub CLI must resolve to a single-link physical regular file');
    }
    accessSync(path, constants.X_OK);
    const header = Buffer.alloc(4);
    if (readSync(descriptor, header, 0, header.length, 0) !== header.length) {
      throw new Error('GitHub CLI native executable header is incomplete');
    }
    const magic = header.toString('hex');
    const nativeBinary = magic === '7f454c46'
      || ['feedface', 'feedfacf', 'cefaedfe', 'cffaedfe', 'cafebabe', 'bebafeca'].includes(magic)
      || header.subarray(0, 2).toString('ascii') === 'MZ';
    if (!nativeBinary) throw new Error('GitHub CLI must be a native executable, not a script or command shim');
    return {
      dev: stats.dev,
      ino: stats.ino,
      mode: stats.mode,
      size: stats.size,
      mtimeMs: stats.mtimeMs,
      ctimeMs: stats.ctimeMs,
    };
  } finally {
    closeSync(descriptor);
  }
}

function sameExecutableIdentity(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

function platformPathDelimiter(platform) {
  return platform === 'win32' ? ';' : ':';
}

function platformAbsolute(path, platform) {
  return platform === 'win32' ? win32.isAbsolute(path) : isAbsolute(path);
}

/** Resolve gh once, outside the caller-controlled worktree, and pin its physical identity. */
export function resolveTrustedGithubCli({ cwd = process.cwd(), env = process.env, platform = process.platform } = {}) {
  const physicalCwd = realpathSync.native(cwd);
  const rawPath = String(env.PATH ?? env.Path ?? '');
  const entries = rawPath.split(platformPathDelimiter(platform));
  if (entries.length === 0 || entries.every((entry) => entry.length === 0)) throw new Error('GitHub CLI PATH is empty');
  const safeEntries = [];
  for (const entry of entries) {
    if (!entry || !platformAbsolute(entry, platform)) {
      throw new Error('GitHub CLI PATH must contain only non-empty absolute directories');
    }
    const lexical = resolve(entry);
    if (pathInside(physicalCwd, lexical)) throw new Error('GitHub CLI PATH must not contain the release workspace');
    let physical;
    try { physical = realpathSync.native(lexical); } catch { continue; }
    const stats = lstatSync(physical);
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error('GitHub CLI PATH entries must resolve to physical directories');
    if (pathInside(physicalCwd, physical)) throw new Error('GitHub CLI PATH must not resolve inside the release workspace');
    if (!safeEntries.includes(physical)) safeEntries.push(physical);
  }
  const names = platform === 'win32' ? ['gh.exe'] : ['gh'];
  for (const directory of safeEntries) {
    for (const name of names) {
      const candidate = resolve(directory, name);
      let physical;
      try { physical = realpathSync.native(candidate); } catch { continue; }
      if (pathInside(physicalCwd, physical)) throw new Error('GitHub CLI resolves inside the release workspace');
      try {
        const identity = executableIdentity(physical);
        // The release subcommands receive an explicit --repo and do not need
        // to discover Git or any other helper. Keep their child PATH limited
        // to the pinned gh directory instead of forwarding later host entries.
        return { command: physical, identity, path: dirname(physical) };
      } catch (error) {
        if (error?.code === 'EACCES' || error?.code === 'ENOENT') continue;
        throw error;
      }
    }
  }
  throw new Error('GitHub CLI is unavailable on the trusted executable PATH');
}

export function validateGithubReleaseTarget(repository, host = 'github.com') {
  if (host !== 'github.com') throw new Error('GitHub Release publication host must be exactly github.com');
  if (typeof repository !== 'string' || !githubRepositoryPattern.test(repository)) {
    throw new Error('GitHub Release publication repository must be an explicit OWNER/REPO slug');
  }
  return { host, repository, qualifiedRepository: `${host}/${repository}` };
}

export function githubReleaseEnvironment({ env = process.env, invocation, repository, host = 'github.com', platform = process.platform }) {
  const target = validateGithubReleaseTarget(repository, host);
  const token = env.GH_TOKEN ?? env.GITHUB_TOKEN;
  if (typeof token !== 'string' || token.length === 0 || token.includes('\0')) {
    throw new Error('GitHub Release publication requires GH_TOKEN or GITHUB_TOKEN');
  }
  const result = {
    PATH: invocation.path,
    GH_TOKEN: token,
    GH_HOST: target.host,
    GH_REPO: target.qualifiedRepository,
    GH_PROMPT_DISABLED: '1',
    GH_NO_UPDATE_NOTIFIER: '1',
    GH_NO_EXTENSION_UPDATE_NOTIFIER: '1',
    NO_COLOR: '1',
    LC_ALL: 'C',
  };
  for (const key of networkEnvironmentKeys) {
    if (typeof env[key] === 'string' && !env[key].includes('\0')) result[key] = env[key];
  }
  if (platform === 'win32') {
    for (const key of ['SystemRoot', 'WINDIR']) if (typeof env[key] === 'string') result[key] = env[key];
  }
  return result;
}

/**
 * Create the credentialed gh boundary used by the release transaction.
 * @param {{repository?: string, host?: string, cwd?: string, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform, runner?: typeof spawnSync}} [options]
 */
export function createGithubReleaseRunner({
  repository,
  host = 'github.com',
  cwd = process.cwd(),
  env = process.env,
  platform = process.platform,
  runner = spawnSync,
} = {}) {
  const target = validateGithubReleaseTarget(repository, host);
  const invocation = resolveTrustedGithubCli({ cwd, env, platform });
  const childEnv = githubReleaseEnvironment({ env, invocation, ...target, platform });
  return function gh(args, { tolerate = false } = {}) {
    const before = executableIdentity(invocation.command);
    if (!sameExecutableIdentity(invocation.identity, before)) throw new Error('GitHub CLI identity changed before release invocation');
    let result;
    try {
      result = runner(invocation.command, [...args, '--repo', target.qualifiedRepository], {
        cwd,
        env: childEnv,
        encoding: 'utf8',
        shell: false,
        windowsHide: true,
        timeout: githubReleaseTimeoutMs,
        maxBuffer: githubReleaseMaxBuffer,
        killSignal: 'SIGTERM',
      });
    } finally {
      const after = executableIdentity(invocation.command);
      if (!sameExecutableIdentity(invocation.identity, after)) throw new Error('GitHub CLI identity changed during release invocation');
    }
    if (result.error) throw new Error(result.error.code === 'ETIMEDOUT' ? 'GitHub CLI release invocation timed out' : `GitHub CLI release invocation failed: ${result.error.message}`);
    if (!tolerate && result.status !== 0) throw new Error(result.stderr?.trim() || `gh ${args[0]} failed`);
    return result;
  };
}

function validateReleaseTag(tag, prerelease) {
  const pattern = prerelease ? candidateTagPattern : stableTagPattern;
  if (typeof tag !== 'string' || !pattern.test(tag)) {
    throw new Error(`release tag must be an exact ${prerelease ? 'candidate' : 'stable'} SemVer tag`);
  }
}

function readReleaseAssets(dir, label = 'release assets directory') {
  const boundary = createPhysicalReadBoundary(dir, label);
  const names = readPhysicalDirectory(boundary, dir, label);
  const collisionKeys = new Map();
  const records = [];
  for (const name of names) {
    assertPortableRelativePath(name, 'release asset name');
    if (name.includes('/')) throw new Error(`release asset name must be a single path component: ${name}`);
    const collisionKey = portablePathCollisionKey(name);
    const prior = collisionKeys.get(collisionKey);
    if (prior) throw new Error(`release asset names collide after portable normalization: ${prior} and ${name}`);
    collisionKeys.set(collisionKey, name);
    const file = readPhysicalFile(boundary, resolve(dir, name), `release asset ${name}`);
    records.push({ name, path: file.path, buffer: file.buffer, sha256: file.sha256, bytes: file.bytes });
  }
  return records.sort((left, right) => comparePortablePaths(left.name, right.name));
}

function stageReleaseInputs(assetsDir, notes) {
  const sourceAssets = readReleaseAssets(assetsDir);
  if (sourceAssets.length === 0) throw new Error('release assets directory must contain at least one asset');
  const notesParent = dirname(notes);
  const notesBoundary = createPhysicalReadBoundary(notesParent, 'release notes parent');
  const notesSource = readPhysicalFile(notesBoundary, notes, 'release notes');
  if (notesSource.bytes === 0) throw new Error('release notes must not be empty');
  let notesText;
  try {
    notesText = new TextDecoder('utf-8', { fatal: true }).decode(notesSource.buffer);
  } catch {
    throw new Error('release notes must contain valid UTF-8');
  }
  if (notesText.includes('\0')) throw new Error('release notes must not contain NUL bytes');

  const root = mkdtempSync(resolve(tmpdir(), 'nova-release-inputs-'));
  const assetsRoot = resolve(root, 'assets');
  const notesRoot = resolve(root, 'notes');
  mkdirSync(assetsRoot, { mode: 0o700 });
  mkdirSync(notesRoot, { mode: 0o700 });
  try {
    for (const asset of sourceAssets) {
      writeFileSync(resolve(assetsRoot, asset.name), asset.buffer, { flag: 'wx', mode: 0o600 });
    }
    const stagedNotes = resolve(notesRoot, 'release-notes.md');
    writeFileSync(stagedNotes, notesSource.buffer, { flag: 'wx', mode: 0o600 });
    const boundary = createPhysicalReadBoundary(root, 'staged release inputs');
    const stagedAssets = sourceAssets.map((asset) => {
      const staged = readPhysicalFile(boundary, resolve(assetsRoot, asset.name), `staged release asset ${asset.name}`);
      if (staged.sha256 !== asset.sha256 || staged.bytes !== asset.bytes) {
        throw new Error(`staged release asset differs from its source: ${asset.name}`);
      }
      return {
        name: asset.name,
        path: staged.path,
        sha256: staged.sha256,
        bytes: staged.bytes,
        identity: { dev: staged.dev, ino: staged.ino, mode: staged.mode },
      };
    });
    const stagedNotesRecord = readPhysicalFile(boundary, stagedNotes, 'staged release notes');
    if (stagedNotesRecord.sha256 !== notesSource.sha256 || stagedNotesRecord.bytes !== notesSource.bytes) {
      throw new Error('staged release notes differ from their source');
    }
    return {
      root,
      boundary,
      assets: stagedAssets,
      notes: {
        path: stagedNotesRecord.path,
        sha256: stagedNotesRecord.sha256,
        bytes: stagedNotesRecord.bytes,
        identity: { dev: stagedNotesRecord.dev, ino: stagedNotesRecord.ino, mode: stagedNotesRecord.mode },
        text: notesText,
      },
    };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

function verifyStagedReleaseInputs(staged) {
  for (const expected of [...staged.assets, staged.notes]) {
    const label = expected.name ?? 'notes';
    const observed = readPhysicalFile(staged.boundary, expected.path, `staged release input ${label}`);
    if (observed.sha256 !== expected.sha256 || observed.bytes !== expected.bytes
      || observed.dev !== expected.identity.dev || observed.ino !== expected.identity.ino
      || observed.mode !== expected.identity.mode) {
      throw new Error(`staged release input changed identity or content: ${label}`);
    }
  }
}

function failureMessage(result, fallback) {
  return result.stderr?.trim() || fallback;
}

function releaseIsMissing(result) {
  return result.status !== 0 && (/^release not found$/iu.test(result.stderr?.trim() ?? '') || /\bHTTP 404\b/iu.test(result.stderr ?? ''));
}

function releaseHasNoAssets(result) {
  return result.status !== 0 && /no assets found/iu.test(result.stderr ?? '');
}

/**
 * @param {{tag: string, assetsDir: string, notes: string, prerelease?: boolean, repository?: string, host?: string}} options
 * @param {{ghRun?: (args: string[], options?: {tolerate?: boolean}) => any, cwd?: string, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform, runner?: typeof spawnSync}} [dependencies]
 */
export function reconcileGithubRelease({ tag, assetsDir, notes, prerelease = false, repository, host = 'github.com' }, dependencies = {}) {
  validateReleaseTag(tag, prerelease);
  const staged = stageReleaseInputs(assetsDir, notes);
  try {
    const rawGhRun = dependencies.ghRun ?? createGithubReleaseRunner({ repository, host, ...dependencies });
    const ghRun = (args, options) => {
      verifyStagedReleaseInputs(staged);
      try {
        return rawGhRun(args, options);
      } finally {
        verifyStagedReleaseInputs(staged);
      }
    };
    const expected = staged.assets;
    const stagedNotes = staged.notes.path;
    const existing = ghRun(['release', 'view', tag, '--json', 'isDraft,isPrerelease,name,body'], { tolerate: true });
    let existingRelease = null;
    if (releaseIsMissing(existing)) {
      ghRun(['release', 'create', tag, '--verify-tag', '--draft', `--prerelease=${prerelease}`, '--notes-file', stagedNotes, '--title', `nova-plugin ${tag}`]);
    } else if (existing.status !== 0) throw new Error(failureMessage(existing, `unable to inspect release ${tag}`));
    else {
      existingRelease = JSON.parse(existing.stdout);
      if (typeof existingRelease.isDraft !== 'boolean') throw new Error(`release ${tag} returned an invalid draft state`);
    }
    const alreadyPublished = existingRelease?.isDraft === false;
    if (alreadyPublished) {
      const expectedTitle = `nova-plugin ${tag}`;
      if (existingRelease.isPrerelease !== prerelease
        || existingRelease.name !== expectedTitle
        || existingRelease.body !== staged.notes.text) {
        throw new Error(`published release ${tag} metadata differs from the requested transaction`);
      }
    }

    const download = mkdtempSync(resolve(tmpdir(), 'nova-release-assets-'));
    try {
      const downloaded = ghRun(['release', 'download', tag, '--dir', download], { tolerate: true });
      if (downloaded.status !== 0 && !releaseHasNoAssets(downloaded)) {
        throw new Error(failureMessage(downloaded, `unable to inspect release assets for ${tag}`));
      }
      const actual = readReleaseAssets(download, 'downloaded release assets');
      const plan = reconcileReleaseAssets(expected, actual);
      if (!plan.publishable) throw new Error(`release asset conflict requires quarantine: ${plan.quarantine.map((entry) => entry.actual?.name).join(', ')}`);
      if (alreadyPublished) {
        if (plan.upload.length || plan.reuse.length !== expected.length) {
          throw new Error(`published release ${tag} asset inventory differs from the requested transaction`);
        }
        return { uploaded: [], reused: plan.reuse.map((asset) => asset.name), published: true, resumed: true };
      }
      if (plan.upload.length) ghRun(['release', 'upload', tag, ...plan.upload.map((asset) => asset.path)]);
      rmSync(download, { recursive: true, force: true });
      const verify = mkdtempSync(resolve(tmpdir(), 'nova-release-assets-verify-'));
      try {
        ghRun(['release', 'download', tag, '--dir', verify]);
        const verified = reconcileReleaseAssets(expected, readReleaseAssets(verify, 'verified release assets'));
        if (!verified.publishable || verified.upload.length || verified.reuse.length !== expected.length) {
          throw new Error('downloaded release asset inventory differs before publication');
        }
      } finally { rmSync(verify, { recursive: true, force: true }); }
      ghRun([
        'release', 'edit', tag,
        '--draft=false',
        `--prerelease=${prerelease}`,
        '--notes-file', stagedNotes,
        '--title', `nova-plugin ${tag}`,
      ]);
      return { uploaded: plan.upload.map((asset) => asset.name), reused: plan.reuse.map((asset) => asset.name), published: true };
    } finally { rmSync(download, { recursive: true, force: true }); }
  } finally { rmSync(staged.root, { recursive: true, force: true }); }
}

export function main(args = process.argv.slice(2)) {
  try {
    const options = { tag: null, assetsDir: null, notes: null, repository: null, host: null };
    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      const value = () => requireOptionValue(args, index, arg);
      if (arg === '--prerelease') { options.prerelease = true; continue; }
      if (arg === '--tag') options.tag = value();
      else if (arg === '--assets-dir') options.assetsDir = resolve(value());
      else if (arg === '--notes') options.notes = resolve(value());
      else if (arg === '--repository') options.repository = value();
      else if (arg === '--host') options.host = value();
      else throw new Error(`unknown argument: ${arg}`);
      index += 1;
    }
    if (!options.tag || !options.assetsDir || !options.notes || !options.repository || !options.host) {
      throw new Error('--tag, --assets-dir, --notes, --repository, and --host are required');
    }
    console.log(JSON.stringify(reconcileGithubRelease(options), null, 2));
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();

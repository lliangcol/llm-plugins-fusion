import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs, {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, resolve } from 'node:path';
import test from 'node:test';
import {
  assertNoHiddenGitIndexFlags,
  gitHead,
  gitSnapshotReader,
  gitWorktreeSourceReader,
} from '../../scripts/lib/git-source-snapshot.mjs';

function git(root, args, options = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', ...options }).trim();
}

function repository(t, name) {
  const root = mkdtempSync(resolve(tmpdir(), name));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.name', 'Snapshot Test']);
  git(root, ['config', 'user.email', 'snapshot@example.invalid']);
  return root;
}

function commitAll(root, message) {
  git(root, ['add', '-A']);
  git(root, ['commit', '--quiet', '-m', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

test('trusted Git reads ignore inherited repository and config injection', (t) => {
  const intended = repository(t, 'nova-git-source-intended-');
  const injected = repository(t, 'nova-git-source-injected-');
  writeFileSync(resolve(intended, 'intended.txt'), 'intended\n');
  writeFileSync(resolve(injected, 'injected.txt'), 'injected\n');
  const intendedHead = commitAll(intended, 'intended');
  commitAll(injected, 'injected');

  const keys = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0'];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.GIT_DIR = resolve(injected, '.git');
    process.env.GIT_WORK_TREE = injected;
    process.env.GIT_CONFIG_COUNT = '1';
    process.env.GIT_CONFIG_KEY_0 = 'core.worktree';
    process.env.GIT_CONFIG_VALUE_0 = injected;
    assert.equal(gitHead(intended), intendedHead);
    assert.deepEqual(gitWorktreeSourceReader(intended).listFiles('intended.txt'), ['intended.txt']);
    assert.doesNotThrow(() => assertNoHiddenGitIndexFlags(intended));
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

test('worktree manifests ignore machine-local excludes and worktree redirects but preserve repository .gitignore', (t) => {
  const root = repository(t, 'nova-git-source-config-isolation-');
  const home = mkdtempSync(resolve(tmpdir(), 'nova-git-source-home-'));
  const outside = mkdtempSync(resolve(tmpdir(), 'nova-git-source-worktree-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  t.after(() => rmSync(outside, { recursive: true, force: true }));

  mkdirSync(resolve(root, 'source'));
  writeFileSync(resolve(root, '.gitignore'), 'source/ignored.txt\n');
  writeFileSync(resolve(root, 'source/tracked.txt'), 'tracked\n');
  commitAll(root, 'tracked source and ignore policy');
  for (const name of ['global.txt', 'local.txt', 'info.txt', 'ignored.txt']) {
    writeFileSync(resolve(root, 'source', name), `${name}\n`);
  }
  const globalExcludes = resolve(home, 'global-excludes');
  const localExcludes = resolve(home, 'local-excludes');
  writeFileSync(globalExcludes, 'global.txt\n');
  writeFileSync(localExcludes, 'local.txt\n');
  writeFileSync(resolve(home, '.gitconfig'), `[core]\n\texcludesFile = ${globalExcludes}\n`);
  git(root, ['config', 'core.excludesFile', localExcludes]);
  writeFileSync(resolve(root, '.git/info/exclude'), 'info.txt\n');
  mkdirSync(resolve(outside, 'source'));
  writeFileSync(resolve(outside, 'source/redirected.txt'), 'redirected\n');
  git(root, ['config', 'core.worktree', outside]);

  const originalHome = process.env.HOME;
  try {
    process.env.HOME = home;
    assert.deepEqual(gitWorktreeSourceReader(root).listFiles('source'), [
      'source/global.txt',
      'source/info.txt',
      'source/local.txt',
      'source/tracked.txt',
    ]);
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
  }
});

test('trusted Git reads ignore a repository-owned PATH shadow', { skip: process.platform === 'win32' }, (t) => {
  const root = repository(t, 'nova-git-source-path-shadow-');
  writeFileSync(resolve(root, 'tracked.txt'), 'tracked\n');
  const head = commitAll(root, 'tracked');
  const bin = resolve(root, 'bin');
  const marker = resolve(root, 'shadow-ran');
  mkdirSync(bin);
  writeFileSync(resolve(bin, 'git'), `#!/bin/sh\nprintf shadow > ${JSON.stringify(marker)}\nexit 99\n`);
  chmodSync(resolve(bin, 'git'), 0o755);
  const originalPath = process.env.PATH;
  try {
    process.env.PATH = `${bin}${delimiter}${originalPath ?? ''}`;
    assert.equal(gitHead(root), head);
    assert.equal(existsSync(marker), false);
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
  }
});

test('Git calls reject a repository root replaced during root capture', (t) => {
  const intended = repository(t, 'nova-git-source-root-capture-');
  const injected = repository(t, 'nova-git-source-root-injected-');
  const moved = `${intended}-moved`;
  t.after(() => rmSync(moved, { recursive: true, force: true }));
  writeFileSync(resolve(intended, 'value.txt'), 'intended\n');
  writeFileSync(resolve(injected, 'value.txt'), 'injected\n');
  commitAll(intended, 'intended');
  commitAll(injected, 'injected');

  const originalNative = fs.realpathSync.native;
  let swapped = false;
  try {
    fs.realpathSync.native = function injectedRealpath(path, ...args) {
      const result = originalNative.call(this, path, ...args);
      if (!swapped && resolve(String(path)) === intended) {
        swapped = true;
        renameSync(intended, moved);
        renameSync(injected, intended);
      }
      return result;
    };
    assert.throws(() => gitHead(intended), /repository root changed identity/u);
    assert.equal(swapped, true);
  } finally {
    fs.realpathSync.native = originalNative;
  }
});

test('worktree readers bind repository identity across list and content access', (t) => {
  const intended = repository(t, 'nova-git-source-reader-root-');
  const injected = repository(t, 'nova-git-source-reader-injected-');
  const moved = `${intended}-moved`;
  t.after(() => rmSync(moved, { recursive: true, force: true }));
  mkdirSync(resolve(intended, 'source'));
  mkdirSync(resolve(injected, 'source'));
  writeFileSync(resolve(intended, 'source/value.txt'), 'intended\n');
  writeFileSync(resolve(injected, 'source/value.txt'), 'injected\n');
  commitAll(intended, 'intended');
  commitAll(injected, 'injected');
  const reader = gitWorktreeSourceReader(intended);
  assert.deepEqual(reader.listFiles('source'), ['source/value.txt']);

  renameSync(intended, moved);
  renameSync(injected, intended);
  assert.throws(() => reader.readText('source/value.txt'), /repository root changed identity/u);
  assert.throws(() => reader.fileMode('source/value.txt'), /repository root changed identity/u);
});

test('snapshot reads disable replace objects and require an exact commit object', (t) => {
  const root = repository(t, 'nova-git-source-replace-');
  writeFileSync(resolve(root, 'value.txt'), 'original\n');
  const originalCommit = commitAll(root, 'original');
  writeFileSync(resolve(root, 'value.txt'), 'replacement\n');
  const replacementCommit = commitAll(root, 'replacement');
  git(root, ['replace', originalCommit, replacementCommit]);
  assert.equal(git(root, ['show', `${originalCommit}:value.txt`]), 'replacement', 'fixture must prove replace refs are active by default');

  const reader = gitSnapshotReader(root, originalCommit);
  assert.equal(reader.readText('value.txt'), 'original\n');
  const tree = git(root, ['rev-parse', `${originalCommit}^{tree}`]);
  assert.throws(() => gitSnapshotReader(root, tree), /exact commit object/u);
});

test('gitHead rejects a HEAD ref that points to a non-commit object', (t) => {
  const root = repository(t, 'nova-git-source-noncommit-head-');
  writeFileSync(resolve(root, 'value.txt'), 'value\n');
  const commit = commitAll(root, 'value');
  const tree = git(root, ['rev-parse', `${commit}^{tree}`]);
  writeFileSync(resolve(root, '.git/HEAD'), `${tree}\n`);
  assert.throws(() => gitHead(root), /HEAD could not be resolved/u);
});

test('snapshot content methods reject symlink blobs and gitlinks before reading bytes', { skip: process.platform === 'win32' }, (t) => {
  const root = repository(t, 'nova-git-source-modes-');
  mkdirSync(resolve(root, 'source'));
  writeFileSync(resolve(root, 'source/regular.json'), '{"ok":true}\n');
  symlinkSync('regular.json', resolve(root, 'source/link.json'));
  const firstCommit = commitAll(root, 'regular and symlink');
  git(root, ['update-index', '--add', '--cacheinfo', `160000,${firstCommit},source/gitlink`]);
  git(root, ['commit', '--quiet', '-m', 'gitlink']);
  const reader = gitSnapshotReader(root, git(root, ['rev-parse', 'HEAD']));

  for (const method of ['readBuffer', 'readText', 'readJson', 'sha256']) {
    assert.throws(() => reader[method]('source/link.json'), /symbolic link or non-regular entry/u, `${method} symlink`);
    assert.throws(() => reader[method]('source/gitlink'), /symbolic link or non-regular entry/u, `${method} gitlink`);
  }
});

test('source readers decode UTF-8 fatally and return defensive buffer copies', (t) => {
  const root = repository(t, 'nova-git-source-encoding-');
  writeFileSync(resolve(root, 'valid.json'), '{"ok":true}\n');
  writeFileSync(resolve(root, 'invalid.json'), Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xc3, 0x28, 0x7d]));
  const commit = commitAll(root, 'encoding');

  for (const reader of [gitWorktreeSourceReader(root), gitSnapshotReader(root, commit)]) {
    assert.throws(() => reader.readText('invalid.json'), /not valid UTF-8/u);
    assert.throws(() => reader.readJson('invalid.json'), /not valid UTF-8/u);
    const first = reader.readBuffer('valid.json');
    first.fill(0);
    assert.equal(reader.readText('valid.json'), '{"ok":true}\n');
    assert.notDeepEqual(reader.readBuffer('valid.json'), first);
  }
});

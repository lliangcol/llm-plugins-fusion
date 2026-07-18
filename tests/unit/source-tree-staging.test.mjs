import assert from 'node:assert/strict';
import fs, {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { stageRepositoryFile, stageRepositoryTree } from '../../scripts/lib/source-tree-staging.mjs';

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), 'nova-source-staging-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = resolve(root, 'repo');
  mkdirSync(resolve(repo, 'source/nested'), { recursive: true });
  writeFileSync(resolve(repo, 'source/file.txt'), 'source bytes\n');
  writeFileSync(resolve(repo, 'source/nested/tool'), 'tool\n');
  chmodSync(resolve(repo, 'source/file.txt'), 0o640);
  chmodSync(resolve(repo, 'source/nested/tool'), 0o750);
  const files = ['source/file.txt', 'source/nested/tool'];
  const reader = {
    listFiles(path) {
      if (path === 'source') return [...files];
      return files.includes(path) ? [path] : [];
    },
    readBuffer(path) {
      return readFileSync(resolve(repo, ...path.split('/')));
    },
    fileMode(path) {
      return statSync(resolve(repo, ...path.split('/'))).mode & 0o777;
    },
  };
  return { root, repo, reader };
}

test('source tree staging publishes an absent tree atomically and preserves file modes', { skip: process.platform === 'win32' }, (t) => {
  const { root, repo, reader } = fixture(t);
  const destination = resolve(root, 'missing-parent/staged');
  assert.deepEqual(stageRepositoryTree(repo, 'source', destination, reader), ['source/file.txt', 'source/nested/tool']);
  assert.equal(readFileSync(resolve(destination, 'file.txt'), 'utf8'), 'source bytes\n');
  assert.equal(readFileSync(resolve(destination, 'nested/tool'), 'utf8'), 'tool\n');
  assert.equal(statSync(resolve(destination, 'file.txt')).mode & 0o777, 0o640);
  assert.equal(statSync(resolve(destination, 'nested/tool')).mode & 0o777, 0o750);
});

test('source staging refuses linked and non-regular outputs without changing external bytes or modes', { skip: process.platform === 'win32' }, (t) => {
  const { root, repo, reader } = fixture(t);
  const externalFile = resolve(root, 'external.txt');
  const fileTarget = resolve(root, 'file-target.txt');
  writeFileSync(externalFile, 'external bytes\n');
  chmodSync(externalFile, 0o620);
  const externalMode = statSync(externalFile).mode & 0o777;

  symlinkSync(externalFile, fileTarget);
  assert.throws(
    () => stageRepositoryFile(repo, 'source/file.txt', fileTarget, reader),
    /physical regular file|symlink|aliases/u,
  );
  assert.equal(readFileSync(externalFile, 'utf8'), 'external bytes\n');
  assert.equal(statSync(externalFile).mode & 0o777, externalMode);
  unlinkSync(fileTarget);

  linkSync(externalFile, fileTarget);
  assert.throws(
    () => stageRepositoryFile(repo, 'source/file.txt', fileTarget, reader),
    /hard linked/u,
  );
  assert.equal(readFileSync(externalFile, 'utf8'), 'external bytes\n');
  assert.equal(statSync(externalFile).mode & 0o777, externalMode);
  unlinkSync(fileTarget);

  const outsideTree = resolve(root, 'outside-tree');
  const treeTarget = resolve(root, 'tree-target');
  mkdirSync(outsideTree);
  writeFileSync(resolve(outsideTree, 'sentinel'), 'outside tree\n');
  chmodSync(outsideTree, 0o710);
  const outsideTreeMode = statSync(outsideTree).mode & 0o777;
  symlinkSync(outsideTree, treeTarget, 'dir');
  assert.throws(
    () => stageRepositoryTree(repo, 'source', treeTarget, reader),
    /physical regular file|symlink|must not already exist/u,
  );
  assert.deepEqual(readdirSync(outsideTree), ['sentinel']);
  assert.equal(readFileSync(resolve(outsideTree, 'sentinel'), 'utf8'), 'outside tree\n');
  assert.equal(statSync(outsideTree).mode & 0o777, outsideTreeMode);
  unlinkSync(treeTarget);

  linkSync(externalFile, treeTarget);
  assert.throws(
    () => stageRepositoryTree(repo, 'source', treeTarget, reader),
    /hard linked/u,
  );
  assert.equal(readFileSync(externalFile, 'utf8'), 'external bytes\n');
  assert.equal(statSync(externalFile).mode & 0o777, externalMode);
  unlinkSync(treeTarget);

  mkdirSync(treeTarget);
  assert.throws(
    () => stageRepositoryTree(repo, 'source', treeTarget, reader),
    /physical regular file|must not already exist/u,
  );
  assert.deepEqual(readdirSync(treeTarget), []);
});

test('source staging rejects direct and overlapping source-destination aliases before writing', { skip: process.platform === 'win32' }, (t) => {
  const { repo, reader } = fixture(t);
  const sourceFile = resolve(repo, 'source/file.txt');
  const sourceMode = statSync(sourceFile).mode & 0o777;
  assert.throws(
    () => stageRepositoryFile(repo, 'source/file.txt', sourceFile, reader),
    /aliases its repository source/u,
  );
  assert.equal(readFileSync(sourceFile, 'utf8'), 'source bytes\n');
  assert.equal(statSync(sourceFile).mode & 0o777, sourceMode);

  const nestedTree = resolve(repo, 'source/staged');
  assert.throws(
    () => stageRepositoryTree(repo, 'source', nestedTree, reader),
    /aliases or overlaps/u,
  );
  assert.equal(readdirSync(resolve(repo, 'source')).includes('staged'), false);
});

test('single-file source staging uses a physical atomic write and preserves source mode', { skip: process.platform === 'win32' }, (t) => {
  const { root, repo, reader } = fixture(t);
  const destination = resolve(root, 'workspace/AGENTS.md');
  stageRepositoryFile(repo, 'source/file.txt', destination, reader);
  assert.equal(readFileSync(destination, 'utf8'), 'source bytes\n');
  assert.equal(statSync(destination).mode & 0o777, 0o640);
});

test('source tree staging rejects silent short writes and ineffective mode application', { skip: process.platform === 'win32' }, (t) => {
  const { root, repo, reader } = fixture(t);
  const originalWriteFileSync = fs.writeFileSync;
  let shortWriteInjected = false;
  fs.writeFileSync = function silentShortWrite(descriptor, content, ...args) {
    if (!shortWriteInjected && typeof descriptor === 'number') {
      shortWriteInjected = true;
      const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
      return originalWriteFileSync.call(this, descriptor, bytes.subarray(0, 2), ...args);
    }
    return originalWriteFileSync.call(this, descriptor, content, ...args);
  };
  syncBuiltinESMExports();
  const shortDestination = resolve(root, 'short-output');
  try {
    assert.throws(
      () => stageRepositoryTree(repo, 'source', shortDestination, reader),
      /byte count or mode differs/u,
    );
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    syncBuiltinESMExports();
  }
  assert.equal(shortWriteInjected, true);
  assert.equal(fs.existsSync(shortDestination), false);

  const originalFchmodSync = fs.fchmodSync;
  let modeInjected = false;
  fs.fchmodSync = function ineffectiveMode(descriptor, mode) {
    if (!modeInjected) {
      modeInjected = true;
      return undefined;
    }
    return originalFchmodSync.call(this, descriptor, mode);
  };
  syncBuiltinESMExports();
  const modeDestination = resolve(root, 'mode-output');
  const priorUmask = process.umask(0o077);
  try {
    assert.throws(
      () => stageRepositoryTree(repo, 'source', modeDestination, reader),
      /did not retain its requested mode/u,
    );
  } finally {
    process.umask(priorUmask);
    fs.fchmodSync = originalFchmodSync;
    syncBuiltinESMExports();
  }
  assert.equal(modeInjected, true);
  assert.equal(fs.existsSync(modeDestination), false);
});

test('single-file source staging applies mode before publication and cleans post-fchmod failures', { skip: process.platform === 'win32' }, (t) => {
  const { root, repo, reader } = fixture(t);
  const destination = resolve(root, 'post-fchmod/AGENTS.md');
  const originalFchmodSync = fs.fchmodSync;
  let injected = false;
  fs.fchmodSync = function chmodThenThrow(descriptor, mode) {
    const result = originalFchmodSync.call(this, descriptor, mode);
    if (!injected) {
      injected = true;
      throw Object.assign(new Error('injected post-fchmod failure'), { code: 'EIO' });
    }
    return result;
  };
  syncBuiltinESMExports();
  try {
    assert.throws(
      () => stageRepositoryFile(repo, 'source/file.txt', destination, reader),
      /injected post-fchmod failure/u,
    );
  } finally {
    fs.fchmodSync = originalFchmodSync;
    syncBuiltinESMExports();
  }
  assert.equal(injected, true);
  assert.equal(fs.existsSync(destination), false);
  assert.deepEqual(readdirSync(resolve(root, 'post-fchmod')), []);
});

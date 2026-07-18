import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs, {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  appendArtifactFileSafely,
  prepareArtifactOutputPlan,
  resolveArtifactOutputPath,
  writeArtifactDirectoryAtomically,
  writeArtifactFileAtomically,
  writeArtifactOutput,
} from '../../scripts/lib/artifact-output.mjs';

function patchBuiltin(name, replacement) {
  const original = fs[name];
  fs[name] = replacement(original);
  syncBuiltinESMExports();
  return () => {
    fs[name] = original;
    syncBuiltinESMExports();
  };
}

async function fixture(t) {
  const parent = await mkdtemp(join(tmpdir(), 'nova-artifact-output-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const repository = join(parent, 'repository');
  await mkdir(join(repository, '.metrics'), { recursive: true });
  await mkdir(join(repository, '.git'), { recursive: true });
  await writeFile(join(repository, 'package.json'), '{"private":true}\n');
  await writeFile(join(repository, '.git/config'), '[core]\n');
  return { parent, repository };
}

test('artifact outputs reject repository source, Git control data, and relative escape', async (t) => {
  const { repository } = await fixture(t);
  for (const path of ['package.json', '.git/config', 'scripts/report.json', '../escaped.json']) {
    assert.throws(
      () => resolveArtifactOutputPath(repository, path, 'test output'),
      /outside the repository|artifact root|traversal/u,
      path,
    );
  }
  assert.equal(
    resolveArtifactOutputPath(repository, '.metrics/report.json', 'test output'),
    join(repository, '.metrics/report.json'),
  );
});

test('artifact directories publish as one rename and clean failed staging content', async (t) => {
  const { repository } = await fixture(t);
  assert.throws(() => writeArtifactDirectoryAtomically(
    repository,
    '.metrics/failed-directory',
    (staging) => {
      // This file must never become visible at the requested destination.
      writeFileSync(join(staging, 'partial.txt'), 'partial\n');
      throw new Error('populate failed');
    },
  ), /populate failed/u);
  assert.equal(existsSync(join(repository, '.metrics/failed-directory')), false);

  const published = writeArtifactDirectoryAtomically(
    repository,
    '.metrics/published-directory',
    (staging) => {
      // Synchronous population mirrors the release archive extractor.
      writeFileSync(join(staging, 'complete.txt'), 'complete\n');
      return 'complete';
    },
  );
  assert.equal(published.path, join(repository, '.metrics/published-directory'));
  assert.equal(published.result, 'complete');
  assert.equal(await readFile(join(published.path, 'complete.txt'), 'utf8'), 'complete\n');
});

test('artifact outputs reject an external symlink alias back into repository source', { skip: process.platform === 'win32' }, async (t) => {
  const { parent, repository } = await fixture(t);
  const alias = join(parent, 'repository-alias');
  await symlink(repository, alias);
  assert.throws(
    () => resolveArtifactOutputPath(repository, join(alias, 'package.json'), 'test output'),
    /aliases across the repository boundary/u,
  );
});

test('artifact writes are atomic and reject linked targets without changing their bytes', async (t) => {
  const { parent, repository } = await fixture(t);
  const target = join(repository, '.metrics/report.json');
  writeArtifactFileAtomically(repository, '.metrics/report.json', '{"ok":true}\n');
  assert.equal(await readFile(target, 'utf8'), '{"ok":true}\n');

  const outside = join(parent, 'outside.json');
  await writeFile(outside, 'preserve\n');
  await rm(target);
  await link(outside, target);
  assert.throws(
    () => writeArtifactFileAtomically(repository, '.metrics/report.json', 'replace\n'),
    /hard linked/u,
  );
  assert.equal(await readFile(outside, 'utf8'), 'preserve\n');
});

test('artifact plans reject aliases before writing and preserve distinct external outputs', async (t) => {
  const { parent, repository } = await fixture(t);
  const external = join(parent, 'external.json');
  const plan = prepareArtifactOutputPlan(repository, [
    { key: 'repository', path: '.metrics/repository.json', label: 'repository output' },
    { key: 'external', path: external, label: 'external output' },
  ]);
  writeArtifactOutput(plan, 'repository', 'repo\n');
  writeArtifactOutput(plan, 'external', 'external\n');
  assert.equal(await readFile(join(repository, '.metrics/repository.json'), 'utf8'), 'repo\n');
  assert.equal(await readFile(external, 'utf8'), 'external\n');

  assert.throws(() => prepareArtifactOutputPlan(repository, [
    { key: 'first', path: '.metrics/same.json', label: 'first output' },
    { key: 'second', path: '.metrics/same.json', label: 'second output' },
  ]), /must not lexically or physically alias/u);
  assert.throws(() => prepareArtifactOutputPlan(repository, [
    { key: 'same', path: '.metrics/first.json', label: 'first output' },
    { key: 'same', path: '.metrics/second.json', label: 'second output' },
  ]), /duplicate key/u);
  for (const [left, right] of [['Foo.json', 'foo.json'], ['é.json', 'e\u0301.json']]) {
    assert.throws(() => prepareArtifactOutputPlan(repository, [
      { key: 'left', path: `.metrics/${left}`, label: 'left output' },
      { key: 'right', path: `.metrics/${right}`, label: 'right output' },
    ]), /must not lexically or physically alias/u);
  }
});

test('artifact plans validate every target before creating any output parent', async (t) => {
  const { repository } = await fixture(t);
  await writeFile(join(repository, '.metrics/not-a-directory'), 'blocking file\n');
  assert.throws(() => prepareArtifactOutputPlan(repository, [
    { key: 'first', path: '.metrics/created-too-early/result.json', label: 'first output' },
    { key: 'second', path: '.metrics/not-a-directory/result.json', label: 'invalid later output' },
  ]), /physical directory|ENOTDIR/u);
  assert.equal(existsSync(join(repository, '.metrics/created-too-early')), false);
});

test('artifact append restores the original size after partial writes and post-write failures', async (t) => {
  const { repository } = await fixture(t);
  const target = join(repository, '.metrics/command-file.txt');
  await writeFile(target, 'original\n');

  let injectedPartial = false;
  let restore = patchBuiltin('writeFileSync', (original) => function partialWrite(path, content, ...args) {
    if (!injectedPartial && typeof path === 'number') {
      injectedPartial = true;
      original.call(this, path, Buffer.from(content).subarray(0, 3), ...args);
      throw new Error('injected partial append');
    }
    return original.call(this, path, content, ...args);
  });
  try {
    assert.throws(
      () => appendArtifactFileSafely(repository, '.metrics/command-file.txt', 'additional\n'),
      /injected partial append/u,
    );
  } finally {
    restore();
  }
  assert.equal(injectedPartial, true);
  assert.equal(await readFile(target, 'utf8'), 'original\n');

  let injectedFsync = false;
  restore = patchBuiltin('fsyncSync', (original) => function postWriteFailure(descriptor) {
    const result = original.call(this, descriptor);
    if (!injectedFsync) {
      injectedFsync = true;
      throw new Error('injected post-write validation failure');
    }
    return result;
  });
  try {
    assert.throws(
      () => appendArtifactFileSafely(repository, '.metrics/command-file.txt', 'additional\n'),
      /injected post-write validation failure/u,
    );
  } finally {
    restore();
  }
  assert.equal(injectedFsync, true);
  assert.equal(await readFile(target, 'utf8'), 'original\n');
});

test('atomic artifact writers reconcile a completed rename that reports an error', async (t) => {
  const { repository } = await fixture(t);
  const fileTarget = join(repository, '.metrics/reconciled.json');
  let injectedFile = false;
  let restore = patchBuiltin('renameSync', (original) => function renameThenThrow(from, to) {
    const result = original.call(this, from, to);
    if (!injectedFile && String(from).endsWith('.tmp')) {
      injectedFile = true;
      throw Object.assign(new Error('injected post-file-rename failure'), { code: 'EIO' });
    }
    return result;
  });
  let fileResult;
  try {
    fileResult = writeArtifactFileAtomically(repository, '.metrics/reconciled.json', 'published\n');
  } finally {
    restore();
  }
  assert.equal(injectedFile, true);
  assert.equal(await readFile(fileTarget, 'utf8'), 'published\n');
  assert.equal(fileResult.bytes, Buffer.byteLength('published\n'));
  assert.equal(fileResult.sha256, createHash('sha256').update('published\n').digest('hex'));

  const directoryTarget = join(repository, '.metrics/reconciled-directory');
  let injectedDirectory = false;
  restore = patchBuiltin('renameSync', (original) => function directoryRenameThenThrow(from, to) {
    const result = original.call(this, from, to);
    if (!injectedDirectory && String(from).endsWith('.tmp-dir')) {
      injectedDirectory = true;
      throw Object.assign(new Error('injected post-directory-rename failure'), { code: 'EIO' });
    }
    return result;
  });
  try {
    writeArtifactDirectoryAtomically(repository, '.metrics/reconciled-directory', (staging) => {
      writeFileSync(join(staging, 'complete.txt'), 'complete\n');
    });
  } finally {
    restore();
  }
  assert.equal(injectedDirectory, true);
  assert.equal(await readFile(join(directoryTarget, 'complete.txt'), 'utf8'), 'complete\n');
});

test('atomic file verification rejects a rename wrapper that mutates the published inode', async (t) => {
  const { repository } = await fixture(t);
  const target = join(repository, '.metrics/tampered.json');
  let injected = false;
  const restore = patchBuiltin('renameSync', (original) => function renameThenTamper(from, to) {
    const result = original.call(this, from, to);
    if (!injected && String(from).endsWith('.tmp')) {
      injected = true;
      fs.writeFileSync(to, 'tampered!\n');
      throw Object.assign(new Error('injected rename-and-tamper failure'), { code: 'EIO' });
    }
    return result;
  });
  try {
    assert.throws(
      () => writeArtifactFileAtomically(repository, '.metrics/tampered.json', 'expected\n'),
      /changed identity|content metadata|committed bytes/u,
    );
  } finally {
    restore();
  }
  assert.equal(injected, true);
  assert.equal(await readFile(target, 'utf8'), 'tampered!\n');
});

test('atomic file replacement preserves the leased mode under a restrictive umask', async (t) => {
  const { repository } = await fixture(t);
  const target = join(repository, '.metrics/mode.json');
  await writeFile(target, 'old\n');
  chmodSync(target, 0o644);
  const previousUmask = process.umask(0o077);
  let result;
  try {
    result = writeArtifactFileAtomically(repository, '.metrics/mode.json', 'new\n');
  } finally {
    process.umask(previousUmask);
  }
  assert.equal(statSync(target).mode & 0o777, 0o644);
  assert.equal(result.mode, 0o644);
});

test('atomic writers clean post-create failures and preserve EEXIST temporary objects', async (t) => {
  const { repository } = await fixture(t);
  const metrics = join(repository, '.metrics');
  let temporaryPath;
  let restore = patchBuiltin('openSync', (original) => function openThenThrow(path, flags, mode) {
    if (!temporaryPath && String(path).endsWith('.tmp')) {
      const descriptor = original.call(this, path, flags, mode);
      fs.closeSync(descriptor);
      temporaryPath = path;
      throw new Error('injected post-open failure');
    }
    return original.call(this, path, flags, mode);
  });
  try {
    assert.throws(
      () => writeArtifactFileAtomically(repository, '.metrics/open-failed.json', 'never published\n'),
      /injected post-open failure/u,
    );
  } finally {
    restore();
  }
  assert.equal(existsSync(temporaryPath), false);

  let foreignFile;
  restore = patchBuiltin('openSync', (original) => function reportForeignCollision(path, flags, mode) {
    if (!foreignFile && String(path).endsWith('.tmp')) {
      foreignFile = path;
      fs.writeFileSync(path, 'foreign\n');
      throw Object.assign(new Error('injected EEXIST'), { code: 'EEXIST' });
    }
    return original.call(this, path, flags, mode);
  });
  try {
    assert.throws(
      () => writeArtifactFileAtomically(repository, '.metrics/open-eexist.json', 'never published\n'),
      /injected EEXIST/u,
    );
  } finally {
    restore();
  }
  assert.equal(await readFile(foreignFile, 'utf8'), 'foreign\n');

  let temporaryDirectory;
  restore = patchBuiltin('mkdirSync', (original) => function mkdirThenThrow(path, options) {
    if (!temporaryDirectory && String(path).endsWith('.tmp-dir')) {
      temporaryDirectory = path;
      original.call(this, path, options);
      fs.writeFileSync(join(path, 'partial.txt'), 'partial\n');
      throw new Error('injected post-mkdir failure');
    }
    return original.call(this, path, options);
  });
  try {
    assert.throws(
      () => writeArtifactDirectoryAtomically(repository, '.metrics/mkdir-failed', () => {}),
      /injected post-mkdir failure/u,
    );
  } finally {
    restore();
  }
  assert.equal(existsSync(temporaryDirectory), false);

  let foreignDirectory;
  restore = patchBuiltin('mkdirSync', (original) => function reportForeignDirectory(path, options) {
    if (!foreignDirectory && String(path).endsWith('.tmp-dir')) {
      foreignDirectory = path;
      original.call(this, path, options);
      fs.writeFileSync(join(path, 'foreign.txt'), 'foreign\n');
      throw Object.assign(new Error('injected directory EEXIST'), { code: 'EEXIST' });
    }
    return original.call(this, path, options);
  });
  try {
    assert.throws(
      () => writeArtifactDirectoryAtomically(repository, '.metrics/mkdir-eexist', () => {}),
      /injected directory EEXIST/u,
    );
  } finally {
    restore();
  }
  assert.equal(await readFile(join(foreignDirectory, 'foreign.txt'), 'utf8'), 'foreign\n');
  assert.equal(existsSync(metrics), true);
  assert.equal(lstatSync(foreignDirectory).isDirectory(), true);
});

test('artifact plans reject ancestor targets before creating parents and support prototype-like keys safely', async (t) => {
  const { repository } = await fixture(t);
  assert.throws(
    () => prepareArtifactOutputPlan(repository, [
      { key: 'parent', path: '.metrics/ancestor.json', label: 'parent output' },
      { key: 'child', path: '.metrics/ancestor.json/child.json', label: 'child output' },
    ]),
    /ancestor or descendant/u,
  );
  assert.equal(existsSync(join(repository, '.metrics/ancestor.json')), false);

  const plan = prepareArtifactOutputPlan(repository, [
    { key: '__proto__', path: '.metrics/prototype-key.json', label: 'prototype output' },
  ]);
  assert.equal(Object.getPrototypeOf(plan.outputs), null);
  assert.equal(Object.hasOwn(plan.outputs, '__proto__'), true);
  writeArtifactOutput(plan, '__proto__', 'safe\n');
  assert.equal(await readFile(join(repository, '.metrics/prototype-key.json'), 'utf8'), 'safe\n');
  assert.throws(() => writeArtifactOutput(plan, 'constructor', 'unsafe\n'), /does not contain constructor/u);
});

test('atomic file writes verify staged bytes before replacing an existing target', async (t) => {
  const { repository } = await fixture(t);
  const target = join(repository, '.metrics/precommit-digest.json');
  await writeFile(target, 'original\n');
  let injected = false;
  const restore = patchBuiltin('writeFileSync', (original) => function silentShortWrite(descriptor, content, ...args) {
    if (!injected && typeof descriptor === 'number') {
      injected = true;
      const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
      return original.call(this, descriptor, bytes.subarray(0, 3), ...args);
    }
    return original.call(this, descriptor, content, ...args);
  });
  try {
    assert.throws(
      () => writeArtifactFileAtomically(repository, '.metrics/precommit-digest.json', 'expected-complete\n'),
      /temporary bytes do not match/u,
    );
  } finally {
    restore();
  }
  assert.equal(injected, true);
  assert.equal(await readFile(target, 'utf8'), 'original\n');
  assert.deepEqual((await fs.promises.readdir(join(repository, '.metrics'))).sort(), ['precommit-digest.json']);
});

test('artifact append detects a silent short write and restores the original file', async (t) => {
  const { repository } = await fixture(t);
  const target = join(repository, '.metrics/append-integrity.txt');
  await writeFile(target, 'original\n');
  let injected = false;
  const restore = patchBuiltin('writeFileSync', (original) => function silentShortAppend(descriptor, content, ...args) {
    if (!injected && typeof descriptor === 'number') {
      injected = true;
      const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
      return original.call(this, descriptor, bytes.subarray(0, 2), ...args);
    }
    return original.call(this, descriptor, content, ...args);
  });
  try {
    assert.throws(
      () => appendArtifactFileSafely(repository, '.metrics/append-integrity.txt', 'append-complete\n'),
      /appended byte count differs/u,
    );
  } finally {
    restore();
  }
  assert.equal(injected, true);
  assert.equal(await readFile(target, 'utf8'), 'original\n');
});

test('atomic directory writes remove an identity-matched publish after subtree verification fails', async (t) => {
  const { repository } = await fixture(t);
  const target = join(repository, '.metrics/tampered-tree');
  let injected = false;
  const restore = patchBuiltin('renameSync', (original) => function renameThenTamper(from, to) {
    const result = original.call(this, from, to);
    if (!injected && String(from).endsWith('.tmp-dir')) {
      injected = true;
      fs.writeFileSync(join(to, 'child.txt'), 'tampered\n');
      throw Object.assign(new Error('injected post-rename tamper'), { code: 'EIO' });
    }
    return result;
  });
  try {
    assert.throws(
      () => writeArtifactDirectoryAtomically(repository, '.metrics/tampered-tree', (staging) => {
        writeFileSync(join(staging, 'child.txt'), 'expected\n');
      }),
      /contents changed during atomic commit/u,
    );
  } finally {
    restore();
  }
  assert.equal(injected, true);
  assert.equal(existsSync(target), false);
});

test('atomic directory cleanup preserves a replacement path after the published root changes identity', async (t) => {
  const { repository } = await fixture(t);
  const target = join(repository, '.metrics/replaced-tree');
  const displaced = join(repository, '.metrics/displaced-tree');
  let injected = false;
  const restore = patchBuiltin('renameSync', (original) => function renameThenReplace(from, to) {
    const result = original.call(this, from, to);
    if (!injected && String(from).endsWith('.tmp-dir')) {
      injected = true;
      original.call(this, to, displaced);
      mkdirSync(to);
      writeFileSync(join(to, 'foreign.txt'), 'foreign\n');
    }
    return result;
  });
  try {
    assert.throws(
      () => writeArtifactDirectoryAtomically(repository, '.metrics/replaced-tree', (staging) => {
        writeFileSync(join(staging, 'child.txt'), 'expected\n');
      }),
      (error) => {
        assert.equal(error instanceof AggregateError, true);
        assert.match(error.message, /cleanup was incomplete/u);
        assert.equal(
          error.errors.some((nestedError) => (
            nestedError instanceof Error
            && /published directory changed identity before cleanup/u.test(nestedError.message)
          )),
          true,
        );
        return true;
      },
    );
  } finally {
    restore();
  }
  assert.equal(injected, true);
  assert.equal(await readFile(join(target, 'foreign.txt'), 'utf8'), 'foreign\n');
  assert.equal(await readFile(join(displaced, 'child.txt'), 'utf8'), 'expected\n');
});

test('atomic directory staging normalizes umask and cleans restrictive trees after commit failure', async (t) => {
  const { repository } = await fixture(t);
  const priorUmask = process.umask(0o777);
  try {
    writeArtifactDirectoryAtomically(repository, '.metrics/private-tree', (staging) => {
      writeFileSync(join(staging, 'child.txt'), 'complete\n');
      chmodSync(join(staging, 'child.txt'), 0o600);
    });
  } finally {
    process.umask(priorUmask);
  }
  assert.equal(await readFile(join(repository, '.metrics/private-tree/child.txt'), 'utf8'), 'complete\n');

  const restore = patchBuiltin('renameSync', (original) => function rejectDirectoryCommit(from, to) {
    if (String(from).endsWith('.tmp-dir')) throw Object.assign(new Error('injected pre-rename failure'), { code: 'EIO' });
    return original.call(this, from, to);
  });
  try {
    assert.throws(
      () => writeArtifactDirectoryAtomically(repository, '.metrics/restrictive-failure', (staging) => {
        mkdirSync(join(staging, 'locked'));
        writeFileSync(join(staging, 'locked/secret.txt'), 'secret\n');
        chmodSync(join(staging, 'locked'), 0o000);
      }),
      /injected pre-rename failure/u,
    );
  } finally {
    restore();
  }
  assert.deepEqual((await fs.promises.readdir(join(repository, '.metrics'))).sort(), ['private-tree']);
});

test('atomic file cleanup reports an unlink failure instead of hiding a sensitive stage', async (t) => {
  const { repository } = await fixture(t);
  let wrote = false;
  let unlinkAttempted = false;
  const restoreWrite = patchBuiltin('writeFileSync', (original) => function writeThenFail(descriptor, content, ...args) {
    if (!wrote && typeof descriptor === 'number') {
      wrote = true;
      original.call(this, descriptor, 'private-partial\n', ...args);
      throw Object.assign(new Error('injected write failure'), { code: 'EIO' });
    }
    return original.call(this, descriptor, content, ...args);
  });
  const restoreUnlink = patchBuiltin('unlinkSync', (original) => function rejectCleanup(path, ...args) {
    if (String(path).endsWith('.tmp')) {
      unlinkAttempted = true;
      throw Object.assign(new Error('injected unlink failure'), { code: 'EIO' });
    }
    return original.call(this, path, ...args);
  });
  try {
    assert.throws(
      () => writeArtifactFileAtomically(repository, '.metrics/cleanup-failure.json', 'expected\n'),
      /cleanup was incomplete/u,
    );
  } finally {
    restoreUnlink();
    restoreWrite();
  }
  assert.equal(wrote, true);
  assert.equal(unlinkAttempted, true);
  const [temporary] = (await fs.promises.readdir(join(repository, '.metrics'))).filter((name) => name.endsWith('.tmp'));
  assert.equal(await readFile(join(repository, '.metrics', temporary), 'utf8'), 'private-partial\n');
});

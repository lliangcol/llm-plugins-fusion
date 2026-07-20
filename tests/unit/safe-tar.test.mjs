import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import fs, { mkdirSync, writeFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { chmod, mkdir, mkdtemp, readFile, readlink, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { deterministicTar } from '../../scripts/build-release-artifacts.mjs';
import { createPhysicalReadBoundary, writePhysicalDirectoryAtomically } from '../../scripts/lib/physical-read-boundary.mjs';
import { extractSafeTarGz, parseTarEntries, parseTarGzEntries, validateTarEntry } from '../../scripts/lib/safe-tar.mjs';

function rewriteFirstTarDirectory(tar, path, mode) {
  const rewritten = Buffer.from(tar);
  rewritten.fill(0, 0, 100);
  rewritten.write(path, 0, 'utf8');
  rewritten.fill(0, 100, 108);
  rewritten.write(`${mode.toString(8).padStart(7, '0')}\0`, 100, 'ascii');
  rewritten.fill(0x20, 148, 156);
  const checksum = rewritten.subarray(0, 512).reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0');
  rewritten.write(`${checksum}\0 `, 148, 'ascii');
  return rewritten;
}

function rewriteFirstTarTextField(tar, offset, length, value) {
  const rewritten = Buffer.from(tar);
  rewritten.fill(0, offset, offset + length);
  const content = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  content.copy(rewritten, offset, 0, Math.min(content.length, length));
  rewritten.fill(0x20, 148, 156);
  const checksum = rewritten.subarray(0, 512).reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0');
  rewritten.write(`${checksum}\0 `, 148, 'ascii');
  return rewritten;
}

test('safe tar extraction preserves regular files, modes, and complete symlink targets', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const output = join(root, 'output');
  await mkdir(join(source, 'bin'), { recursive: true });
  await writeFile(join(source, 'bin/tool'), 'tool', { mode: 0o755 });
  await symlink('bin/tool', join(source, 'current'));
  const archive = gzipSync(deterministicTar(source), { mtime: 0 });
  extractSafeTarGz(archive, output, { allowSymlinks: true });
  assert.equal(await readFile(join(output, 'bin/tool'), 'utf8'), 'tool');
  assert.equal(await readlink(join(output, 'current')), 'bin/tool');
});

test('safe tar extraction keeps mode-000 directories traversable until their children exist', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-mode-zero-'));
  t.after(async () => {
    try { await chmod(join(root, 'output/locked'), 0o700); } catch { /* output may not exist */ }
    await rm(root, { recursive: true, force: true });
  });
  const source = join(root, 'source');
  const output = join(root, 'output');
  await mkdir(join(source, 'locked'), { recursive: true });
  await writeFile(join(source, 'locked/child.txt'), 'child\n');
  const rewritten = rewriteFirstTarDirectory(deterministicTar(source), 'locked/', 0o000);
  const entries = parseTarEntries(rewritten);
  assert.deepEqual(entries.slice(0, 2).map(({ path, type, mode }) => ({ path, type, mode })), [
    { path: 'locked', type: 'directory', mode: 0 },
    { path: 'locked/child.txt', type: 'file', mode: 0o644 },
  ]);
  extractSafeTarGz(gzipSync(rewritten, { mtime: 0 }), output);
  assert.equal((await stat(join(output, 'locked'))).mode & 0o777, 0);
  await chmod(join(output, 'locked'), 0o700);
  assert.equal(await readFile(join(output, 'locked/child.txt'), 'utf8'), 'child\n');
});

test('mode-000 archive directories do not strand an atomic temporary tree when a child fails', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-mode-zero-failure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const publicationRoot = join(root, 'publication');
  await mkdir(join(source, 'locked'), { recursive: true });
  await writeFile(join(source, 'locked/child.txt'), 'archive\n');
  await mkdir(publicationRoot);
  const rewritten = rewriteFirstTarDirectory(deterministicTar(source), 'locked/', 0o000);
  const archive = gzipSync(rewritten, { mtime: 0 });
  const boundary = createPhysicalReadBoundary(publicationRoot, 'safe tar failure publication');
  assert.throws(
    () => writePhysicalDirectoryAtomically(
      boundary,
      join(publicationRoot, 'published'),
      (temporaryRoot) => {
        mkdirSync(join(temporaryRoot, 'locked'));
        writeFileSync(join(temporaryRoot, 'locked/child.txt'), 'collision\n');
        extractSafeTarGz(archive, temporaryRoot);
      },
      'safe tar failure output',
    ),
    /refuses to replace|permission denied/u,
  );
  assert.deepEqual(await readdir(publicationRoot), []);
});

test('safe tar validation rejects traversal and every link or device type for control bundles', () => {
  for (const type of ['symlink', 'hardlink', 'device', 'fifo', 'unknown-x']) {
    assert.throws(() => validateTarEntry({ path: 'safe/file', type, target: 'target' }), /forbidden/);
  }
  assert.throws(() => validateTarEntry({ path: '../escape', type: 'file' }), /traversal/);
  assert.throws(() => validateTarEntry({ path: '/absolute', type: 'file' }), /portable/);
  assert.throws(() => validateTarEntry({ path: '.', type: 'directory' }), /traversal|dot/u);
  assert.throws(() => validateTarEntry({ path: 'link', type: 'symlink', target: 'x'.repeat(101) }, { allowSymlinks: true }), /too long/);
});

test('safe tar extraction rejects a root dot entry without chmodding the extraction root', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-root-entry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const output = join(root, 'output');
  await mkdir(join(source, 'directory'), { recursive: true });
  await mkdir(output, { mode: 0o700 });
  await chmod(output, 0o700);
  const beforeMode = (await stat(output)).mode & 0o777;
  const archive = gzipSync(rewriteFirstTarDirectory(deterministicTar(source), '.', 0o777), { mtime: 0 });
  assert.throws(() => extractSafeTarGz(archive, output), /traversal|dot/u);
  assert.equal((await stat(output)).mode & 0o777, beforeMode);
});

test('safe tar parsing never trims or ambiguously terminates names and link targets', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-text-fields-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fileSource = join(root, 'file-source');
  await mkdir(fileSource);
  await writeFile(join(fileSource, 'safe'), 'content');
  const fileTar = deterministicTar(fileSource);
  assert.throws(
    () => parseTarEntries(rewriteFirstTarTextField(fileTar, 0, 100, 'safe ')),
    /non-portable|reserved/u,
  );
  assert.throws(
    () => parseTarEntries(rewriteFirstTarTextField(fileTar, 0, 100, Buffer.from([0x73, 0x61, 0x66, 0x65, 0, 0x78]))),
    /non-zero data after its NUL terminator/u,
  );
  assert.throws(
    () => parseTarEntries(rewriteFirstTarTextField(fileTar, 0, 100, Buffer.from([0xc3, 0x28]))),
    /not valid UTF-8/u,
  );
  assert.throws(
    () => parseTarEntries(rewriteFirstTarTextField(fileTar, 0, 100, Buffer.from([0x73, 0x61, 0x66, 0x65, 0x01]))),
    /control character/u,
  );

  const linkSource = join(root, 'link-source');
  await mkdir(linkSource);
  await symlink('target', join(linkSource, 'current'));
  const linkTar = deterministicTar(linkSource);
  assert.throws(
    () => parseTarEntries(rewriteFirstTarTextField(linkTar, 157, 100, 'target '), { allowSymlinks: true }),
    /non-portable|reserved/u,
  );
});

test('safe tar parsing rejects normalized case collisions', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-case-collision-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  await mkdir(join(source, 'Foo'), { recursive: true });
  const tar = deterministicTar(source);
  const header = tar.subarray(0, 512);
  const collisionTar = (left, right) => Buffer.concat([
    rewriteFirstTarTextField(header, 0, 100, left),
    rewriteFirstTarTextField(header, 0, 100, right),
    Buffer.alloc(1024),
  ]);
  assert.throws(() => parseTarEntries(collisionTar('Foo/', 'foo/')), /normalized case collision/u);
  assert.throws(() => parseTarEntries(collisionTar('É/', 'é/')), /normalized case collision/u);
  assert.throws(() => parseTarEntries(collisionTar('é/', 'e\u0301/')), /normalized case collision/u);
  assert.throws(() => parseTarEntries(collisionTar('ſ/', 's/')), /normalized case collision/u);
  assert.throws(() => parseTarEntries(collisionTar('ß/', 'ss/')), /normalized case collision/u);
  assert.throws(() => parseTarEntries(collisionTar('ς/', 'σ/')), /normalized case collision/u);
  assert.throws(() => parseTarEntries(collisionTar('ﬃ/', 'ffi/')), /normalized case collision/u);
});

test('safe tar extraction preflights ancestor topology before writing in either archive order', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-topology-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  await mkdir(source);
  await writeFile(join(source, 'first'), '');
  await writeFile(join(source, 'second'), '');
  const tar = deterministicTar(source);
  const firstHeader = tar.subarray(0, 512);
  const secondHeader = tar.subarray(512, 1024);

  for (const [index, paths] of [['a', 'a/b'], ['a/b', 'a']].entries()) {
    const output = join(root, `output-${index}`);
    await mkdir(output);
    const invalidTar = Buffer.concat([
      rewriteFirstTarTextField(firstHeader, 0, 100, paths[0]),
      rewriteFirstTarTextField(secondHeader, 0, 100, paths[1]),
      Buffer.alloc(1024),
    ]);
    const archive = gzipSync(invalidTar, { mtime: 0 });
    assert.throws(() => extractSafeTarGz(archive, output), /non-directory ancestor/u);
    assert.deepEqual(await readdir(output), []);
  }
});

test('safe tar parsing rejects compressed, expanded, entry, and count resource limits', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-limits-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'large.txt'), 'bounded');
  await writeFile(join(root, 'second.txt'), 'second');
  const archive = gzipSync(deterministicTar(root), { mtime: 0 });
  assert.throws(() => parseTarGzEntries(archive, { maxArchiveBytes: archive.length - 1 }), /compressed size exceeds/u);
  assert.throws(() => parseTarGzEntries(archive, { maxUncompressedBytes: 512 }), /uncompressed size exceeds/u);
  assert.throws(() => parseTarGzEntries(archive, { maxEntryBytes: 6 }), /entry exceeds/u);
  assert.throws(() => parseTarGzEntries(archive, { maxEntries: 1 }), /more than 1 entries/u);
});

test('safe tar parsing rejects truncated padding and incomplete or ambiguous terminators', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-structure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'file.txt'), 'bounded');
  const tar = deterministicTar(root);
  assert.throws(() => parseTarEntries(tar.subarray(0, 512 + 'bounded'.length)), /padding is truncated/u);
  const nonZeroPadding = Buffer.from(tar);
  nonZeroPadding[512 + 'bounded'.length] = 1;
  assert.throws(() => parseTarEntries(nonZeroPadding), /non-zero padding/u);
  assert.throws(() => parseTarEntries(tar.subarray(0, tar.length - 512)), /second zero terminator/u);
  assert.throws(() => parseTarEntries(Buffer.concat([tar, Buffer.from('non-zero')])), /non-zero data after/u);
});

test('safe tar extraction refuses pre-existing links and does not write outside the destination', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-link-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const output = join(root, 'output');
  const outside = join(root, 'outside.txt');
  await mkdir(source);
  await mkdir(output);
  await writeFile(join(source, 'file.txt'), 'archive\n');
  await writeFile(outside, 'outside\n');
  await symlink(outside, join(output, 'file.txt'));
  const archive = gzipSync(deterministicTar(source), { mtime: 0 });
  assert.throws(() => extractSafeTarGz(archive, output), /refuses to replace/u);
  assert.equal(await readFile(outside, 'utf8'), 'outside\n');
});

test('safe tar extraction refuses a linked destination parent before creating output', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-parent-link-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const outside = join(root, 'outside');
  const linked = join(root, 'linked');
  await mkdir(source);
  await mkdir(outside);
  await writeFile(join(source, 'file.txt'), 'archive\n');
  await symlink(outside, linked);
  const archive = gzipSync(deterministicTar(source), { mtime: 0 });
  assert.throws(() => extractSafeTarGz(archive, join(linked, 'nested')), /destination component is a symlink/u);
  await assert.rejects(() => readFile(join(outside, 'nested', 'file.txt')), { code: 'ENOENT' });
});

test('safe tar extraction preflights every existing target before writing any entry', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-late-collision-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const output = join(root, 'output');
  await mkdir(source);
  await mkdir(output);
  await writeFile(join(source, 'a.txt'), 'first\n');
  await writeFile(join(source, 'z.txt'), 'last\n');
  await writeFile(join(output, 'z.txt'), 'preserve\n');
  const archive = gzipSync(deterministicTar(source), { mtime: 0 });
  assert.throws(() => extractSafeTarGz(archive, output), /refuses to replace/u);
  assert.deepEqual(await readdir(output), ['z.txt']);
  assert.equal(await readFile(join(output, 'z.txt'), 'utf8'), 'preserve\n');
});

test('safe tar extraction rejects silent short writes and removes the partial file', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-short-write-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const output = join(root, 'output');
  await mkdir(source);
  await writeFile(join(source, 'file.txt'), 'archive-complete\n');
  const archive = gzipSync(deterministicTar(source), { mtime: 0 });
  const originalWriteFileSync = fs.writeFileSync;
  let injected = false;
  fs.writeFileSync = function silentShortWrite(descriptor, content, ...args) {
    if (!injected && typeof descriptor === 'number') {
      injected = true;
      const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
      return originalWriteFileSync.call(this, descriptor, bytes.subarray(0, 2), ...args);
    }
    return originalWriteFileSync.call(this, descriptor, content, ...args);
  };
  syncBuiltinESMExports();
  try {
    assert.throws(() => extractSafeTarGz(archive, output), /byte count or mode differs/u);
  } finally {
    fs.writeFileSync = originalWriteFileSync;
    syncBuiltinESMExports();
  }
  assert.equal(injected, true);
  assert.deepEqual(await readdir(output), []);
});

test('safe tar extraction propagates mode failures and removes the failed file', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-safe-tar-mode-failure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source');
  const output = join(root, 'output');
  await mkdir(source);
  await writeFile(join(source, 'file.txt'), 'archive\n');
  const archive = gzipSync(deterministicTar(source), { mtime: 0 });
  const originalFchmodSync = fs.fchmodSync;
  let injected = false;
  fs.fchmodSync = function chmodThenThrow(descriptor, mode) {
    const result = originalFchmodSync.call(this, descriptor, mode);
    if (!injected) {
      injected = true;
      throw Object.assign(new Error('injected chmod failure'), { code: 'EIO' });
    }
    return result;
  };
  syncBuiltinESMExports();
  try {
    assert.throws(() => extractSafeTarGz(archive, output), /injected chmod failure/u);
  } finally {
    fs.fchmodSync = originalFchmodSync;
    syncBuiltinESMExports();
  }
  assert.equal(injected, true);
  assert.deepEqual(await readdir(output), []);
});

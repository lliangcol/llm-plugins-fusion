import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { deterministicTar } from '../../scripts/build-release-artifacts.mjs';
import { extractSafeTarGz, validateTarEntry } from '../../scripts/lib/safe-tar.mjs';

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

test('safe tar validation rejects traversal and every link or device type for control bundles', () => {
  for (const type of ['symlink', 'hardlink', 'device', 'fifo', 'unknown-x']) {
    assert.throws(() => validateTarEntry({ path: 'safe/file', type, target: 'target' }), /forbidden/);
  }
  assert.throws(() => validateTarEntry({ path: '../escape', type: 'file' }), /traversal/);
  assert.throws(() => validateTarEntry({ path: '/absolute', type: 'file' }), /portable/);
  assert.throws(() => validateTarEntry({ path: 'link', type: 'symlink', target: 'x'.repeat(101) }, { allowSymlinks: true }), /too long/);
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

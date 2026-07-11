import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { generateReleaseChecksums } from '../../scripts/generate-release-checksums.mjs';
import { runCoverage } from '../../scripts/lib/coverage-runner.mjs';

test('checksum CLI rejects an option-shaped output value without writing a file', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-cli-side-effect-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.throws(
    () => generateReleaseChecksums({ root, args: ['--out', '--help'] }),
    /--out requires a value/,
  );
  await assert.rejects(stat(join(root, '--help')));
});

test('coverage CLI rejects an option-shaped directory without deleting or creating files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-coverage-side-effect-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sentinel = join(root, 'sentinel');
  await writeFile(sentinel, 'keep', 'utf8');
  assert.equal(runCoverage({ root, args: ['--coverage-dir', '--help'] }), 1);
  assert.equal((await stat(sentinel)).size, 4);
  await assert.rejects(stat(join(root, '--help')));
  await assert.rejects(stat(join(root, '.metrics')));
});

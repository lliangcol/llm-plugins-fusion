import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { discoverTestFiles, relativeTestFiles } from '../../scripts/lib/test-discovery.mjs';

test('test discovery recursively returns deterministic suite-relative files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-test-discovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(join(root, 'tests/unit/nested'), { recursive: true });
  await mkdir(join(root, 'tests/integration'), { recursive: true });
  await writeFile(join(root, 'tests/unit/z.test.mjs'), '', 'utf8');
  await writeFile(join(root, 'tests/unit/a.test.mjs'), '', 'utf8');
  await writeFile(join(root, 'tests/unit/nested/b.test.mjs'), '', 'utf8');
  await writeFile(join(root, 'tests/unit/ignore.mjs'), '', 'utf8');
  await writeFile(join(root, 'tests/integration/c.test.mjs'), '', 'utf8');

  assert.deepEqual(relativeTestFiles(root, 'unit'), [
    'tests/unit/a.test.mjs',
    'tests/unit/nested/b.test.mjs',
    'tests/unit/z.test.mjs',
  ]);
  assert.deepEqual(relativeTestFiles(root, 'all'), [
    'tests/integration/c.test.mjs',
    'tests/unit/a.test.mjs',
    'tests/unit/nested/b.test.mjs',
    'tests/unit/z.test.mjs',
  ]);
});

test('test discovery returns an empty list for a missing suite directory', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-empty-test-discovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  assert.deepEqual(discoverTestFiles(root, 'e2e'), []);
});

test('test discovery rejects unknown suites', () => {
  assert.throws(() => discoverTestFiles(process.cwd(), 'smoke'), /unknown test suite/);
});

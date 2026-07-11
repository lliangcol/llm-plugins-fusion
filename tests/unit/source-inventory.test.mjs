import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  missingCoverageSources,
  sourceModuleInventory,
} from '../../scripts/lib/source-inventory.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('source inventory includes every repository maintenance module deterministically', () => {
  const sources = sourceModuleInventory(repoRoot);
  assert.ok(sources.includes('scripts/run-test-coverage.mjs'));
  assert.ok(sources.includes('nova-plugin/runtime/secret-rules.mjs'));
  assert.ok(sources.every((source) => source.endsWith('.mjs') && !source.startsWith('tests/')));
  assert.deepEqual(sources, [...sources].sort());
});

test('source inventory is defined by Git-tracked files only', () => {
  let captured = null;
  const sources = sourceModuleInventory('/repo', (command, args, options) => {
    captured = { command, args, options };
    return { status: 0, stdout: Buffer.from('scripts/a.mjs\0tests/a.test.mjs\0') };
  });
  assert.deepEqual(captured.args, ['ls-files', '-z', '--cached', '--', '*.mjs']);
  assert.equal(captured.options.shell, false);
  assert.deepEqual(sources, ['scripts/a.mjs']);
});

test('missing coverage source detection reports only unloaded modules', () => {
  assert.deepEqual(
    missingCoverageSources(['a.mjs', 'b.mjs'], ['b.mjs', 'c.mjs']),
    ['a.mjs'],
  );
});

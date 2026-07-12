import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  MARKETPLACE_CATALOG_PATH,
  MARKETPLACE_CANARY_PATH,
  MARKETPLACE_METADATA_PATH,
  MARKETPLACE_PATH,
  generateRegistryFiles,
} from '../../scripts/generate-registry.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '../..');

test('generateRegistryFiles supports the multi-plugin fixture', () => {
  const fixtureRoot = resolve(repoRoot, 'fixtures/registry/multi-plugin');
  const files = generateRegistryFiles(fixtureRoot);
  const byPath = new Map(files.map((file) => [file.relPath, file.content]));

  assert.deepEqual([...byPath.keys()], [
    MARKETPLACE_PATH,
    MARKETPLACE_CANARY_PATH,
    MARKETPLACE_METADATA_PATH,
    MARKETPLACE_CATALOG_PATH,
  ]);

  const marketplace = JSON.parse(byPath.get(MARKETPLACE_PATH));
  const metadata = JSON.parse(byPath.get(MARKETPLACE_METADATA_PATH));

  assert.deepEqual(
    marketplace.plugins.map((plugin) => plugin.name),
    ['alpha-plugin', 'beta-plugin'],
  );
  assert.deepEqual(
    metadata.plugins.map((plugin) => plugin.name),
    ['alpha-plugin', 'beta-plugin'],
  );
  assert.match(byPath.get(MARKETPLACE_CATALOG_PATH), /Plugin count: 2/);
});

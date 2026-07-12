import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildRegistryObjects } from '../../scripts/generate-registry.mjs';
import { SEMVER_PATTERN_SOURCE } from '../../scripts/lib/semver.mjs';

function registryEntry(source, metadata = {}) {
  return {
    localSource: source,
    distributionSource: source,
    category: 'development',
    tags: ['test'],
    metadata: {
      'trust-level': 'community',
      'risk-level': 'low',
      deprecated: false,
      'last-updated': '2026-06-24',
      ...metadata,
    },
  };
}

function pluginManifest(name) {
  return {
    name,
    description: `${name} fixture`,
    version: '1.0.0',
    license: 'MIT',
  };
}

test('repository version schemas share the canonical SemVer pattern', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const pluginSchema = JSON.parse(await readFile(resolve(root, 'schemas/plugin.schema.json'), 'utf8'));
  const marketplaceSchema = JSON.parse(await readFile(resolve(root, 'schemas/marketplace.schema.json'), 'utf8'));
  const metadataSchema = JSON.parse(await readFile(resolve(root, 'schemas/marketplace-metadata.schema.json'), 'utf8'));
  assert.equal(pluginSchema.properties.version.pattern, SEMVER_PATTERN_SOURCE);
  assert.equal(marketplaceSchema.properties.plugins.items.properties.version.pattern, SEMVER_PATTERN_SOURCE);
  assert.equal(metadataSchema.properties.plugins.items.properties.version.pattern, SEMVER_PATTERN_SOURCE);
});

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function createRegistryRoot(t, plugins, manifests = {}) {
  const root = await mkdtemp(join(tmpdir(), 'nova-registry-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(join(root, '.claude-plugin'), { recursive: true });
  await writeJson(join(root, '.claude-plugin', 'registry.source.json'), {
    name: 'fixture-marketplace',
    owner: { name: 'Fixture Owner' },
    plugins,
  });

  for (const [source, manifest] of Object.entries(manifests)) {
    await mkdir(join(root, source, '.claude-plugin'), { recursive: true });
    await writeJson(join(root, source, '.claude-plugin', 'plugin.json'), manifest);
  }

  return root;
}

test('buildRegistryObjects accepts repository-relative plugin sources', async (t) => {
  const root = await createRegistryRoot(t, [
    registryEntry('plugin-a'),
  ], {
    'plugin-a': pluginManifest('plugin-a'),
  });

  const { marketplace, metadata } = buildRegistryObjects(root);

  assert.deepEqual(marketplace.plugins.map((plugin) => plugin.name), ['plugin-a']);
  assert.deepEqual(metadata.plugins.map((plugin) => plugin.name), ['plugin-a']);
});

test('buildRegistryObjects accepts the repository root as a plugin source', async (t) => {
  const root = await createRegistryRoot(t, [
    registryEntry('.'),
  ], {
    '.': pluginManifest('root-plugin'),
  });

  const { marketplace, metadata } = buildRegistryObjects(root);

  assert.deepEqual(marketplace.plugins.map((plugin) => plugin.name), ['root-plugin']);
  assert.deepEqual(metadata.plugins.map((plugin) => plugin.name), ['root-plugin']);
});

test('buildRegistryObjects rejects empty plugin arrays', async (t) => {
  const root = await createRegistryRoot(t, []);

  assert.throws(
    () => buildRegistryObjects(root),
    /non-empty plugins array/,
  );
});

test('buildRegistryObjects rejects plugin sources outside the repository', async (t) => {
  const escapeRoot = await createRegistryRoot(t, [
    registryEntry('../outside-plugin'),
  ]);
  assert.throws(
    () => buildRegistryObjects(escapeRoot),
    /escapes repository root/,
  );

  const urlRoot = await createRegistryRoot(t, [
    registryEntry('https://example.com/plugin.git'),
  ]);
  assert.throws(
    () => buildRegistryObjects(urlRoot),
    /repository-relative path/,
  );

  const absoluteRoot = await createRegistryRoot(t, [
    registryEntry(resolve(escapeRoot, 'plugin-a')),
  ]);
  assert.throws(
    () => buildRegistryObjects(absoluteRoot),
    /must not be absolute/,
  );
});

test('buildRegistryObjects rejects duplicate plugin sources', async (t) => {
  const root = await createRegistryRoot(t, [
    registryEntry('plugin-a'),
    registryEntry('plugin-a/'),
  ], {
    'plugin-a': pluginManifest('plugin-a'),
  });

  assert.throws(
    () => buildRegistryObjects(root),
    /duplicate plugin source: plugin-a\//,
  );
});

test('buildRegistryObjects rejects duplicate plugin names', async (t) => {
  const root = await createRegistryRoot(t, [
    registryEntry('plugin-a'),
    registryEntry('plugin-b'),
  ], {
    'plugin-a': pluginManifest('duplicate-plugin'),
    'plugin-b': pluginManifest('duplicate-plugin'),
  });

  assert.throws(
    () => buildRegistryObjects(root),
    /duplicate plugin name: duplicate-plugin/,
  );
});

test('buildRegistryObjects sorts multi-plugin output by plugin name', async (t) => {
  const root = await createRegistryRoot(t, [
    registryEntry('plugin-b'),
    registryEntry('plugin-a'),
  ], {
    'plugin-a': pluginManifest('alpha-plugin'),
    'plugin-b': pluginManifest('beta-plugin'),
  });

  const { marketplace, metadata } = buildRegistryObjects(root);

  assert.deepEqual(
    marketplace.plugins.map((plugin) => plugin.name),
    ['alpha-plugin', 'beta-plugin'],
  );
  assert.deepEqual(
    metadata.plugins.map((plugin) => plugin.name),
    ['alpha-plugin', 'beta-plugin'],
  );
});

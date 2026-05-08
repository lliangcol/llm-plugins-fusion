#!/usr/bin/env node
/**
 * Validate registry generation behavior against a multi-plugin fixture.
 *
 * This covers the author workflow contract that registry generation must
 * continue to support more than one plugin entry while the repository keeps
 * its current single-plugin `nova-plugin/` layout.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MARKETPLACE_CATALOG_PATH,
  MARKETPLACE_METADATA_PATH,
  MARKETPLACE_PATH,
  buildRegistryObjects,
  generateRegistryFiles,
} from './generate-registry.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const fixtureRoot = resolve(root, 'fixtures/registry/multi-plugin');

const forbiddenMarketplaceKeys = new Set([
  'trust-level',
  'risk-level',
  'deprecated',
  'last-updated',
  'maintainer',
  'compatibility',
  'review',
]);

let failed = 0;

function check(condition, message) {
  if (condition) return;
  failed += 1;
  console.error(`ERROR ${message}`);
}

function collectForbiddenKeyPaths(value, path, paths = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeyPaths(item, `${path}[${index}]`, paths));
    return paths;
  }
  if (!value || typeof value !== 'object') return paths;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (forbiddenMarketplaceKeys.has(key)) paths.push(childPath);
    collectForbiddenKeyPaths(child, childPath, paths);
  }
  return paths;
}

function scanForbiddenKeys(value, path) {
  for (const leakedPath of collectForbiddenKeyPaths(value, path)) {
    check(false, `fixture marketplace output leaks repository-local field ${leakedPath}`);
  }
}

function hasText(value) {
  return typeof value === 'string' && value.length > 0;
}

try {
  const { marketplace, metadata } = buildRegistryObjects(fixtureRoot);
  const pluginNames = marketplace.plugins.map((plugin) => plugin.name).sort();
  const metadataNames = metadata.plugins.map((plugin) => plugin.name).sort();

  check(marketplace.plugins.length === 2, 'fixture marketplace should contain two plugin entries');
  check(metadata.plugins.length === 2, 'fixture metadata should contain two plugin entries');
  check(
    JSON.stringify(pluginNames) === JSON.stringify(['alpha-plugin', 'beta-plugin']),
    `fixture marketplace plugin names mismatch: ${pluginNames.join(', ')}`,
  );
  check(
    JSON.stringify(metadataNames) === JSON.stringify(pluginNames),
    'fixture metadata plugin names should match marketplace plugin names',
  );

  scanForbiddenKeys(marketplace, 'marketplace');
  const syntheticTopLevelLeaks = collectForbiddenKeyPaths(
    { metadata: { maintainer: { name: 'example' }, compatibility: {}, review: {} } },
    'marketplace',
  );
  check(
    syntheticTopLevelLeaks.includes('marketplace.metadata.maintainer')
      && syntheticTopLevelLeaks.includes('marketplace.metadata.compatibility')
      && syntheticTopLevelLeaks.includes('marketplace.metadata.review'),
    'fixture forbidden-key scanner must cover top-level marketplace metadata leaks',
  );

  for (const plugin of metadata.plugins) {
    check(hasText(plugin.maintainer?.name), `${plugin.name} metadata must declare a maintainer name`);
    check(hasText(plugin.compatibility?.commands), `${plugin.name} metadata must declare command coverage evidence`);
    check(hasText(plugin.compatibility?.skills), `${plugin.name} metadata must declare skill coverage evidence`);
    check(hasText(plugin.compatibility?.docs), `${plugin.name} metadata must declare docs evidence`);
    check(hasText(plugin.compatibility?.validation), `${plugin.name} metadata must declare validation evidence`);
    check(hasText(plugin.compatibility?.prerequisites), `${plugin.name} metadata must declare prerequisites evidence`);
    check(hasText(plugin.review?.trustPolicy), `${plugin.name} metadata must declare trust policy evidence`);
    check(hasText(plugin.review?.securityReview), `${plugin.name} metadata must declare security review evidence`);
    check(hasText(plugin.review?.releaseHygiene), `${plugin.name} metadata must declare release hygiene evidence`);
  }

  const generated = generateRegistryFiles(fixtureRoot);
  const generatedPaths = generated.map((file) => file.relPath).sort();
  check(
    JSON.stringify(generatedPaths) === JSON.stringify([
      MARKETPLACE_CATALOG_PATH,
      MARKETPLACE_METADATA_PATH,
      MARKETPLACE_PATH,
    ].sort()),
    `fixture generated output paths mismatch: ${generatedPaths.join(', ')}`,
  );

  const catalog = generated.find((file) => file.relPath === MARKETPLACE_CATALOG_PATH)?.content ?? '';
  check(catalog.includes('## alpha-plugin'), 'fixture generated catalog should include alpha-plugin');
  check(catalog.includes('## beta-plugin'), 'fixture generated catalog should include beta-plugin');
  check(catalog.includes('Compatibility evidence:'), 'fixture generated catalog should include compatibility evidence');
  check(catalog.includes('Review policy:'), 'fixture generated catalog should include review policy');
} catch (error) {
  failed += 1;
  console.error(`ERROR registry fixture validation crashed: ${error.message}`);
}

if (failed > 0) process.exit(1);
console.log('OK registry fixture validation passed');

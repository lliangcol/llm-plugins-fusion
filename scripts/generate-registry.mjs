#!/usr/bin/env node
/**
 * Generate marketplace registry outputs from plugin metadata and the
 * human-maintained registry source file.
 *
 * Usage:
 *   node scripts/generate-registry.mjs
 *   node scripts/generate-registry.mjs --write
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');
const scriptPath = fileURLToPath(import.meta.url);

export const REGISTRY_SOURCE_PATH = '.claude-plugin/registry.source.json';
export const MARKETPLACE_PATH = '.claude-plugin/marketplace.json';
export const MARKETPLACE_METADATA_PATH = '.claude-plugin/marketplace.metadata.json';

function readJson(root, relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), 'utf8'));
}

function writeJson(root, relPath, content) {
  writeFileSync(resolve(root, relPath), content, 'utf8');
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function copyDefined(target, source, key) {
  if (source[key] !== undefined) {
    target[key] = source[key];
  }
}

function pluginManifestPath(entry) {
  if (typeof entry.source !== 'string') {
    throw new Error('registry plugin source must be a string path to a local plugin directory');
  }
  return `${entry.source.replace(/[\\/]+$/, '')}/.claude-plugin/plugin.json`;
}

function buildMarketplacePlugin(entry, plugin) {
  const output = {
    name: plugin.name,
    source: entry.source,
    version: plugin.version,
  };

  copyDefined(output, plugin, 'author');
  copyDefined(output, plugin, 'description');
  copyDefined(output, entry, 'category');
  copyDefined(output, plugin, 'homepage');
  copyDefined(output, plugin, 'repository');
  copyDefined(output, plugin, 'license');
  copyDefined(output, entry, 'tags');
  copyDefined(output, plugin, 'keywords');
  copyDefined(output, entry, 'icon');
  copyDefined(output, entry, 'screenshots');
  copyDefined(output, entry, 'checksum');

  return output;
}

function buildMetadataPlugin(entry, plugin) {
  if (!entry.metadata || typeof entry.metadata !== 'object') {
    throw new Error(`registry metadata is missing for plugin source ${entry.source}`);
  }
  return {
    name: plugin.name,
    version: plugin.version,
    'trust-level': entry.metadata['trust-level'],
    'risk-level': entry.metadata['risk-level'],
    deprecated: entry.metadata.deprecated,
    'last-updated': entry.metadata['last-updated'],
  };
}

export function buildRegistryObjects(root = defaultRoot) {
  const source = readJson(root, REGISTRY_SOURCE_PATH);
  const plugins = source.plugins.map((entry) => ({
    source: entry,
    plugin: readJson(root, pluginManifestPath(entry)),
  }));

  const marketplace = {
    name: source.name,
    owner: source.owner,
  };
  copyDefined(marketplace, source, 'metadata');
  marketplace.plugins = plugins.map(({ source: entry, plugin }) => buildMarketplacePlugin(entry, plugin));

  const metadata = {
    plugins: plugins.map(({ source: entry, plugin }) => buildMetadataPlugin(entry, plugin)),
  };

  return { marketplace, metadata };
}

export function generateRegistryFiles(root = defaultRoot) {
  const { marketplace, metadata } = buildRegistryObjects(root);
  return [
    { relPath: MARKETPLACE_PATH, content: formatJson(marketplace) },
    { relPath: MARKETPLACE_METADATA_PATH, content: formatJson(metadata) },
  ];
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, '\n');
}

function runCli(args) {
  const write = args.includes('--write');
  const help = args.includes('--help') || args.includes('-h');
  const unknown = args.filter((arg) => !['--write', '--help', '-h'].includes(arg));

  if (help) {
    console.log('Usage: node scripts/generate-registry.mjs [--write]');
    return 0;
  }

  if (unknown.length > 0) {
    console.error(`ERROR unknown argument(s): ${unknown.join(', ')}`);
    console.error('Usage: node scripts/generate-registry.mjs [--write]');
    return 1;
  }

  const generated = generateRegistryFiles(defaultRoot);

  if (write) {
    for (const { relPath, content } of generated) {
      writeJson(defaultRoot, relPath, content);
      console.log(`wrote ${relPath}`);
    }
    return 0;
  }

  let drift = false;
  for (const { relPath, content } of generated) {
    const current = normalizeNewlines(readFileSync(resolve(defaultRoot, relPath), 'utf8'));
    if (current !== content) {
      drift = true;
      console.error(`ERROR ${relPath} is out of date; run node scripts/generate-registry.mjs --write`);
    }
  }

  if (drift) {
    return 1;
  }

  console.log('OK generated registry outputs are current');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    process.exitCode = runCli(process.argv.slice(2));
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}

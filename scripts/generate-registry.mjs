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
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');
const scriptPath = fileURLToPath(import.meta.url);

export const REGISTRY_SOURCE_PATH = '.claude-plugin/registry.source.json';
export const MARKETPLACE_PATH = '.claude-plugin/marketplace.json';
export const MARKETPLACE_CANARY_PATH = '.claude-plugin/marketplace.canary.json';
export const MARKETPLACE_METADATA_PATH = '.claude-plugin/marketplace.metadata.json';
export const MARKETPLACE_CATALOG_PATH = 'docs/marketplace/catalog.md';

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

function normalizeRegistrySource(value) {
  return String(value ?? '')
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/');
}

function assertRepositoryRelativeSource(root, source) {
  if (typeof source !== 'string') {
    throw new Error('registry plugin source must be a string path to a local plugin directory');
  }
  const trimmed = source.trim();
  if (!trimmed) {
    throw new Error('registry plugin source must not be empty');
  }
  if (isAbsolute(trimmed)) {
    throw new Error(`registry plugin source must not be absolute: ${source}`);
  }
  if (isExternalLink(trimmed) || trimmed.startsWith('//')) {
    throw new Error(`registry plugin source must be a repository-relative path: ${source}`);
  }

  const rootAbs = resolve(root);
  const sourceAbs = resolve(rootAbs, trimmed);
  const relativeSource = relative(rootAbs, sourceAbs);
  if (relativeSource.startsWith('..') || isAbsolute(relativeSource)) {
    throw new Error(`registry plugin source escapes repository root: ${source}`);
  }
}

function pluginManifestPath(entry, root = defaultRoot) {
  if (typeof entry.localSource !== 'string') {
    throw new Error('registry plugin localSource must be a string path to a local plugin directory');
  }
  assertRepositoryRelativeSource(root, entry.localSource);
  return `${entry.localSource.replace(/[\\/]+$/, '')}/.claude-plugin/plugin.json`;
}

function buildMarketplacePlugin(entry, plugin, distributionSource, version = plugin.version) {
  const output = {
    name: plugin.name,
    source: distributionSource,
    version,
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

function buildMetadataPlugin(entry, plugin, version = plugin.version) {
  if (!entry.metadata || typeof entry.metadata !== 'object') {
    throw new Error(`registry metadata is missing for plugin source ${entry.localSource}`);
  }
  const output = {
    name: plugin.name,
    version,
    'trust-level': entry.metadata['trust-level'],
    'risk-level': entry.metadata['risk-level'],
    deprecated: entry.metadata.deprecated,
    'last-updated': entry.metadata['last-updated'],
  };
  copyDefined(output, entry.metadata, 'maintainer');
  copyDefined(output, entry.metadata, 'compatibility');
  copyDefined(output, entry.metadata, 'review');
  return output;
}

function escapeMarkdown(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

function normalizeRepoPath(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

function isExternalLink(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(String(value));
}

function markdownLink(label, target) {
  if (!target) return escapeMarkdown(label);
  if (isExternalLink(target)) {
    return `[${escapeMarkdown(label)}](${target})`;
  }
  const clean = normalizeRepoPath(target);
  return `[${escapeMarkdown(label)}](../../${clean})`;
}

function pathLink(path) {
  return markdownLink(path, path);
}

function renderCatalog({ marketplace, metadata }) {
  const metadataByName = new Map(metadata.plugins.map((plugin) => [plugin.name, plugin]));
  const lines = [
    '# Marketplace Catalog',
    '',
    '<!-- Generated by node scripts/generate-registry.mjs --write. Do not edit by hand. -->',
    '',
    `Marketplace: ${escapeMarkdown(marketplace.name)}`,
    '',
    `Owner: ${escapeMarkdown(marketplace.owner?.name ?? 'unknown')}`,
    '',
    `Plugin count: ${marketplace.plugins.length}`,
    '',
    'Source data:',
    '',
    `- Registry source: ${pathLink(REGISTRY_SOURCE_PATH)}`,
    `- Claude-compatible marketplace: ${pathLink(MARKETPLACE_PATH)}`,
    `- Repository-local metadata: ${pathLink(MARKETPLACE_METADATA_PATH)}`,
    '',
  ];

  for (const plugin of marketplace.plugins) {
    const localMetadata = metadataByName.get(plugin.name);
    const compatibility = localMetadata?.compatibility ?? {};
    const review = localMetadata?.review ?? {};
    const maintainer = localMetadata?.maintainer;

    lines.push(`## ${escapeMarkdown(plugin.name)}`);
    lines.push('');
    lines.push(`- Version: \`${escapeMarkdown(plugin.version)}\``);
    lines.push(`- Source: \`${escapeMarkdown(typeof plugin.source === 'string' ? plugin.source : JSON.stringify(plugin.source))}\``);
    lines.push(`- Category: \`${escapeMarkdown(plugin.category ?? 'other')}\``);
    lines.push(`- Tags: ${(plugin.tags ?? []).map((tag) => `\`${escapeMarkdown(tag)}\``).join(', ') || 'none'}`);
    lines.push(`- Trust: \`${escapeMarkdown(localMetadata?.['trust-level'] ?? 'unknown')}\``);
    lines.push(`- Risk: \`${escapeMarkdown(localMetadata?.['risk-level'] ?? 'unknown')}\``);
    lines.push(`- Deprecated: \`${localMetadata?.deprecated ? 'true' : 'false'}\``);
    lines.push(`- Last updated: \`${escapeMarkdown(localMetadata?.['last-updated'] ?? 'unknown')}\``);
    if (maintainer) {
      const maintainerParts = [
        maintainer.name ? escapeMarkdown(maintainer.name) : null,
        maintainer.url ? markdownLink(maintainer.url, maintainer.url) : null,
        maintainer.email ? `\`${escapeMarkdown(maintainer.email)}\`` : null,
      ].filter(Boolean);
      lines.push(`- Maintainer: ${maintainerParts.join(' / ')}`);
    }
    if (plugin.description) {
      lines.push(`- Description: ${escapeMarkdown(plugin.description)}`);
    }
    lines.push('');
    lines.push('Compatibility evidence:');
    lines.push('');
    lines.push(`- Commands: ${compatibility.commands ? pathLink(compatibility.commands) : 'not declared'}`);
    lines.push(`- Skills: ${compatibility.skills ? pathLink(compatibility.skills) : 'not declared'}`);
    lines.push(`- Documentation: ${compatibility.docs ? pathLink(compatibility.docs) : 'not declared'}`);
    lines.push(`- Validation: ${compatibility.validation ? pathLink(compatibility.validation) : 'not declared'}`);
    lines.push(`- Prerequisites: ${compatibility.prerequisites ? pathLink(compatibility.prerequisites) : 'not declared'}`);
    lines.push('');
    lines.push('Review policy:');
    lines.push('');
    lines.push(`- Trust policy: ${review.trustPolicy ? pathLink(review.trustPolicy) : 'not declared'}`);
    lines.push(`- Security review: ${review.securityReview ? pathLink(review.securityReview) : 'not declared'}`);
    lines.push(`- Release hygiene: ${review.releaseHygiene ? pathLink(review.releaseHygiene) : 'not declared'}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

export function buildRegistryObjects(root = defaultRoot) {
  const source = readJson(root, REGISTRY_SOURCE_PATH);
  const releaseChannelsPath = resolve(root, 'governance/release-channels.json');
  const releaseChannels = (() => {
    try { return JSON.parse(readFileSync(releaseChannelsPath, 'utf8')); } catch { return null; }
  })();
  if (!Array.isArray(source.plugins) || source.plugins.length === 0) {
    throw new Error('registry.source.json must contain a non-empty plugins array');
  }

  const seenSources = new Set();
  const seenPluginNames = new Set();
  const plugins = source.plugins.map((entry) => {
    assertRepositoryRelativeSource(root, entry.localSource);
    const sourceKey = normalizeRegistrySource(entry.localSource);
    if (seenSources.has(sourceKey)) {
      throw new Error(`duplicate plugin source: ${entry.localSource}`);
    }
    seenSources.add(sourceKey);

    const plugin = readJson(root, pluginManifestPath(entry, root));
    if (typeof plugin.name !== 'string' || plugin.name.trim() === '') {
      throw new Error(`plugin manifest is missing name for source ${entry.localSource}`);
    }
    if (seenPluginNames.has(plugin.name)) {
      throw new Error(`duplicate plugin name: ${plugin.name}`);
    }
    seenPluginNames.add(plugin.name);

    return {
      source: entry,
      plugin,
      stableVersion: releaseChannels?.stable?.version ?? plugin.version,
    };
  }).sort((left, right) => (
    left.plugin.name.localeCompare(right.plugin.name)
    || normalizeRegistrySource(left.source.localSource).localeCompare(normalizeRegistrySource(right.source.localSource))
  ));

  if (releaseChannels) {
    for (const { source: entry } of plugins) {
      if (entry.distributionSource?.ref !== releaseChannels.stable.tag || entry.distributionSource?.sha !== releaseChannels.stable.commit) {
        throw new Error('stable distributionSource must match governance/release-channels.json tag and commit');
      }
      if (entry.canarySource?.ref !== releaseChannels.canary.ref || entry.canarySource?.sha !== undefined) {
        throw new Error('canarySource must point to moving main without a SHA pin');
      }
    }
    const manifestPath = pluginManifestPath(plugins[0].source, root).replace(/^\.\//u, '');
    const shown = spawnSync('git', ['show', `${releaseChannels.stable.commit}:${manifestPath}`], { cwd: root, encoding: 'utf8', shell: false });
    if (shown.status !== 0) throw new Error('stable plugin manifest cannot be read from the pinned commit');
    const stablePlugin = JSON.parse(shown.stdout);
    if (stablePlugin.version !== releaseChannels.stable.version || stablePlugin.name !== plugins[0].plugin.name) {
      throw new Error('stable release channel does not match the pinned plugin manifest');
    }
  }

  const marketplace = {
    name: source.name,
    owner: source.owner,
  };
  copyDefined(marketplace, source, 'metadata');
  marketplace.plugins = plugins.map(({ source: entry, plugin, stableVersion }) => buildMarketplacePlugin(entry, plugin, entry.distributionSource, stableVersion));

  const canaryMarketplace = { name: `${source.name}-canary`, owner: source.owner };
  copyDefined(canaryMarketplace, source, 'metadata');
  canaryMarketplace.plugins = plugins.map(({ source: entry, plugin }) => buildMarketplacePlugin(entry, plugin, entry.canarySource ?? entry.localSource));

  const metadata = {
    plugins: plugins.map(({ source: entry, plugin, stableVersion }) => buildMetadataPlugin(entry, plugin, stableVersion)),
  };

  return { marketplace, canaryMarketplace, metadata };
}

export function generateRegistryFiles(root = defaultRoot) {
  const { marketplace, canaryMarketplace, metadata } = buildRegistryObjects(root);
  return [
    { relPath: MARKETPLACE_PATH, content: formatJson(marketplace) },
    { relPath: MARKETPLACE_CANARY_PATH, content: formatJson(canaryMarketplace) },
    { relPath: MARKETPLACE_METADATA_PATH, content: formatJson(metadata) },
    { relPath: MARKETPLACE_CATALOG_PATH, content: renderCatalog({ marketplace, metadata }) },
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

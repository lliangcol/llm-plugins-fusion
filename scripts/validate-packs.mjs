#!/usr/bin/env node
/**
 * Validate nova-plugin capability pack documentation and routing references.
 */

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

const packsRoot = resolve(root, 'nova-plugin/packs');
const packsIndex = resolve(packsRoot, 'README.md');
const routingDoc = resolve(root, 'docs/agents/PLUGIN_AWARE_ROUTING.md');

const expectedPacks = [
  'dependency',
  'docs',
  'frontend',
  'java',
  'marketplace',
  'mcp',
  'release',
  'security',
].sort();

const requiredSections = [
  'Purpose',
  'When to Use',
  'Related Plugins',
  'Inputs',
  'Agent Routing',
  'Workflow',
  'Verification',
  'Enhanced Mode',
  'Fallback Mode',
  'Failure Modes',
];

const errors = [];

function rel(path) {
  return relative(root, path).split(sep).join('/');
}

function record(file, message) {
  errors.push(`  - ${file}: ${message}`);
}

function sameSet(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function extractPackLinks(src) {
  const links = new Set();
  const pattern = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const match of src.matchAll(pattern)) {
    let target = match[1].trim().split(/\s+/)[0];
    target = target.replace(/^<|>$/g, '');
    target = target.replace(/^\.?\//, '');
    const packMatch = target.match(/^([a-z-]+)\/(?:README\.md)?(?:#[^)]*)?$/);
    if (packMatch) links.add(packMatch[1]);
  }
  return [...links].sort();
}

function extractRoutingPackRefs(src) {
  const refs = new Set();
  const pathPattern = /nova-plugin\/packs\/([a-z-]+)/g;
  for (const match of src.matchAll(pathPattern)) refs.add(match[1]);
  return [...refs].sort();
}

if (!existsSync(packsIndex)) {
  record('nova-plugin/packs/README.md', 'missing packs index');
}

if (!existsSync(packsRoot)) {
  record('nova-plugin/packs', 'missing packs directory');
} else {
  const actualDirs = readdirSync(packsRoot)
    .filter((entry) => {
      const abs = resolve(packsRoot, entry);
      return statSync(abs).isDirectory();
    })
    .sort();

  if (!sameSet(actualDirs, expectedPacks)) {
    record(
      'nova-plugin/packs',
      `pack directories are [${actualDirs.join(', ')}], expected [${expectedPacks.join(', ')}]`,
    );
  }

  for (const pack of expectedPacks) {
    const readme = resolve(packsRoot, pack, 'README.md');
    if (!existsSync(resolve(packsRoot, pack))) {
      record(`nova-plugin/packs/${pack}`, 'missing pack directory');
      continue;
    }
    if (!existsSync(readme)) {
      record(`nova-plugin/packs/${pack}/README.md`, 'missing pack README');
      continue;
    }
    const src = readFileSync(readme, 'utf8');
    for (const section of requiredSections) {
      const pattern = new RegExp(`^## ${section}\\s*$`, 'm');
      if (!pattern.test(src)) {
        record(rel(readme), `missing required section "## ${section}"`);
      }
    }
  }
}

if (existsSync(packsIndex)) {
  const listed = extractPackLinks(readFileSync(packsIndex, 'utf8'));
  if (!sameSet(listed, expectedPacks)) {
    record(
      'nova-plugin/packs/README.md',
      `listed packs are [${listed.join(', ')}], expected [${expectedPacks.join(', ')}]`,
    );
  }
}

if (!existsSync(routingDoc)) {
  record('docs/agents/PLUGIN_AWARE_ROUTING.md', 'missing plugin-aware routing doc');
} else {
  const refs = extractRoutingPackRefs(readFileSync(routingDoc, 'utf8'));
  const missingRefs = refs.filter((pack) => !expectedPacks.includes(pack));
  if (missingRefs.length) {
    record(
      'docs/agents/PLUGIN_AWARE_ROUTING.md',
      `references missing pack(s): ${missingRefs.join(', ')}`,
    );
  }
  const missingExpectedRefs = expectedPacks.filter((pack) => !refs.includes(pack));
  if (missingExpectedRefs.length) {
    record(
      'docs/agents/PLUGIN_AWARE_ROUTING.md',
      `does not reference expected pack(s): ${missingExpectedRefs.join(', ')}`,
    );
  }
}

if (errors.length) {
  console.error(`Capability pack validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log('OK capability pack validation passed');

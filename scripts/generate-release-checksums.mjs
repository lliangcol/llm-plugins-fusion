#!/usr/bin/env node
/**
 * Generate SHA-256 checksums for release-facing source-controlled artifacts.
 *
 * Output is written under .metrics/ by default and must not be committed.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';

assertNodeVersion({ label: 'release checksum generation' });

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const releaseArtifacts = [
  'nova-plugin/.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.claude-plugin/marketplace.metadata.json',
  'docs/marketplace/catalog.md',
];

function usage() {
  return 'Usage: node scripts/generate-release-checksums.mjs [--out <path>]';
}

function parseArgs(args) {
  let out = resolve(root, '.metrics/release-checksums/SHA256SUMS.txt');
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--out') {
      const value = args[index + 1];
      if (!value) {
        console.error('ERROR --out requires a path');
        console.error(usage());
        process.exit(1);
      }
      out = resolve(root, value);
      index += 1;
      continue;
    }
    console.error(`ERROR unknown argument: ${arg}`);
    console.error(usage());
    process.exit(1);
  }
  return out;
}

function checksum(relPath) {
  const data = readFileSync(resolve(root, relPath));
  return createHash('sha256').update(data).digest('hex');
}

const outPath = parseArgs(process.argv.slice(2));
const lines = releaseArtifacts.map((relPath) => `${checksum(relPath)}  ${relPath}`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');

for (const line of lines) console.log(line);
console.log(`Wrote release checksums to ${relative(root, outPath).replaceAll('\\', '/')}`);

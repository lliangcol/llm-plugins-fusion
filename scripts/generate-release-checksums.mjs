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
import { requireOptionValue } from './lib/cli-args.mjs';

assertNodeVersion({ label: 'release checksum generation' });

const __dir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dir, '..');
export const releaseArtifacts = [
  'nova-plugin/.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.claude-plugin/marketplace.metadata.json',
  'docs/marketplace/catalog.md',
];

function usage() {
  return 'Usage: node scripts/generate-release-checksums.mjs [--out <path>]';
}

export function parseArgs(args, root = defaultRoot) {
  let out = resolve(root, '.metrics/release-checksums/SHA256SUMS.txt');
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--out') {
      const value = requireOptionValue(args, index, '--out');
      out = resolve(root, value);
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

function checksum(root, relPath) {
  const data = readFileSync(resolve(root, relPath));
  return createHash('sha256').update(data).digest('hex');
}

export function generateReleaseChecksums({ root = defaultRoot, args = [] } = {}) {
  const outPath = parseArgs(args, root);
  const lines = releaseArtifacts.map((relPath) => `${checksum(root, relPath)}  ${relPath}`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
  return { outPath, lines };
}

export function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return 0;
  }
  try {
    const { outPath, lines } = generateReleaseChecksums({ args });
    for (const line of lines) console.log(line);
    console.log(`Wrote release checksums to ${relative(defaultRoot, outPath).replaceAll('\\', '/')}`);
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    console.error(usage());
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}

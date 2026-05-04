#!/usr/bin/env node
/**
 * Validate compatibility with Claude's current plugin manifest parser.
 *
 * Static checks always run. If the Claude CLI is available, this also runs:
 *   claude plugin validate .
 *   claude plugin validate nova-plugin
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const forbiddenMarketplaceKeys = new Set([
  'trust-level',
  'risk-level',
  'deprecated',
  'last-updated',
]);

let failed = 0;

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(root, relPath), 'utf8'));
}

function commandExists(command) {
  const result = spawnSync(command, ['--version'], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'ignore',
    shell: false,
  });
  return result.status === 0;
}

function run(label, command, args) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    console.error(`ERROR ${label}: ${result.error.message}`);
    failed += 1;
    return;
  }
  if (result.status !== 0) {
    console.error(`ERROR ${label}: exited with ${result.status}`);
    failed += 1;
  }
}

const marketplace = readJson('.claude-plugin/marketplace.json');

function scanForbiddenKeys(value, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbiddenKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (forbiddenMarketplaceKeys.has(key)) {
      console.error(`ERROR .claude-plugin/marketplace.json ${childPath} must not appear in the Claude-compatible manifest`);
      failed += 1;
    }
    scanForbiddenKeys(child, childPath);
  }
}

scanForbiddenKeys(marketplace, '(root)');

if (failed === 0) {
  console.log('OK marketplace manifest has no Claude-rejected plugin metadata fields');
}

if (commandExists('claude')) {
  run('claude plugin validate .', 'claude', ['plugin', 'validate', '.']);
  run('claude plugin validate nova-plugin', 'claude', ['plugin', 'validate', 'nova-plugin']);
} else {
  console.warn('\nWARNING Claude CLI not found; skipping live claude plugin validate checks');
}

if (failed > 0) process.exit(1);

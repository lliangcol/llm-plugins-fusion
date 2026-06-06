#!/usr/bin/env node
/**
 * Maintainer validation wrapper for release-facing local work.
 *
 * This stays separate from validate-all because it also checks generated
 * registry drift and whitespace in the working tree.
 */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';

assertNodeVersion({ label: 'maintainer validation' });

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
let failed = 0;

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
    return false;
  }
  if (result.status !== 0) {
    console.error(`ERROR ${label}: exited with ${result.status}`);
    failed += 1;
    return false;
  }
  return true;
}

run('validate all', process.execPath, ['scripts/validate-all.mjs']);
run('generated registry drift check', process.execPath, ['scripts/generate-registry.mjs']);
run('git diff --check', 'git', ['diff', '--check']);

console.log(`\nSummary: failed=${failed}`);
if (failed > 0) process.exit(1);

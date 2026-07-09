#!/usr/bin/env node
/**
 * Maintainer validation wrapper for release-facing local work.
 *
 * This stays separate from validate-all because it also checks generated
 * registry drift and whitespace in the working tree.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { runProcess } from './lib/process-runner.mjs';

assertNodeVersion({ label: 'maintainer validation' });

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
let failed = 0;

async function run(label, command, args) {
  console.log(`\n== ${label} ==`);
  const result = await runProcess(label, command, args, {
    cwd: root,
    capture: false,
    timeoutMs: 180_000,
  });
  if (!result.ok) {
    const message = result.errorMessage
      ?? (result.code == null ? 'failed' : `exited with ${result.code}`);
    console.error(`ERROR ${label}: ${message}`);
    failed += 1;
    return false;
  }
  return true;
}

await run('npm test', process.execPath, ['--test', 'tests/**/*.test.mjs']);
await run('validate all', process.execPath, ['scripts/validate-all.mjs']);
await run('generated registry drift check', process.execPath, ['scripts/generate-registry.mjs']);
await run('git diff --check', 'git', ['diff', '--check']);
await run('git diff --cached --check', 'git', ['diff', '--cached', '--check']);

console.log(`\nSummary: failed=${failed}`);
if (failed > 0) process.exit(1);

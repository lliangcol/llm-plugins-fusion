#!/usr/bin/env node
/**
 * Run validate-all with Node CPU profiling and local timing output.
 *
 * Outputs are written under .metrics/, which is ignored and must not be
 * committed.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProcess } from './lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const profileDir = resolve(root, '.metrics/cpu-prof');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`Usage: node scripts/profile-validation.mjs

Runs:
  node --cpu-prof --cpu-prof-dir .metrics/cpu-prof scripts/validate-all.mjs --write-timings

Outputs:
  .metrics/validation-timings.json
  .metrics/cpu-prof/*.cpuprofile
`);
  process.exit(0);
}

await mkdir(profileDir, { recursive: true });

const result = await runProcess('profile validate-all', process.execPath, [
  '--cpu-prof',
  '--cpu-prof-dir',
  profileDir,
  'scripts/validate-all.mjs',
  '--write-timings',
], {
  cwd: root,
  capture: false,
  timeoutMs: 180_000,
});

if (!result.ok) {
  const message = result.errorMessage
    ?? (result.code == null ? 'failed' : `exited with ${result.code}`);
  console.error(`ERROR profile validate-all: ${message}`);
  process.exit(result.code ?? 1);
}

console.log('\nWrote validation timings and CPU profile under .metrics/.');

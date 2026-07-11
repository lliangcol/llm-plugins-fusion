#!/usr/bin/env node
/**
 * Run validate-all with Node CPU profiling and local timing output.
 *
 * Outputs are written under .metrics/, which is ignored and must not be
 * committed.
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runProcess } from './lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const profileDir = resolve(root, '.metrics/cpu-prof');

const help = `Usage: node scripts/profile-validation.mjs

Runs:
  node --cpu-prof --cpu-prof-dir .metrics/cpu-prof scripts/validate-all.mjs --write-timings

Outputs:
  .metrics/validation-timings.json
  .metrics/cpu-prof/*.cpuprofile
`;

export async function main({ args = process.argv.slice(2), runner = runProcess, mkdirFn = mkdir } = {}) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(help);
    return 0;
  }
  if (args.length > 0) {
    console.error(`ERROR unknown argument: ${args[0]}`);
    console.error(help);
    return 1;
  }
  await mkdirFn(profileDir, { recursive: true });
  const result = await runner('profile validate-all', process.execPath, [
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
    return result.code ?? 1;
  }
  console.log('\nWrote validation timings and CPU profile under .metrics/.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}

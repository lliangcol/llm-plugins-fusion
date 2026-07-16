#!/usr/bin/env node
/** CPU hotspot profiling or comparable fresh-process benchmark wrapper. */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runProcess } from './lib/process-runner.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const profileDir = resolve(root, '.metrics/cpu-prof');
const reportPath = '.metrics/validation-benchmark.json';
const help = `Usage: node scripts/profile-validation.mjs [--benchmark [--require-profile <id>]]\n\nNo arguments writes a CPU hotspot profile marked non-comparable.\n--benchmark runs one fresh Node process in full/no-cache mode and validates observed elapsed time after the child exits. A required governed profile also verifies every retained sample against GitHub Actions and requires GH_TOKEN or GITHUB_TOKEN.\n`;

export async function main({ args = process.argv.slice(2), runner = runProcess, mkdirFn = mkdir } = {}) {
  if (args.includes('--help') || args.includes('-h')) { console.log(help); return 0; }
  const benchmark = args[0] === '--benchmark';
  let requiredProfile = null;
  if (benchmark && args.length > 1) {
    if (args[1] !== '--require-profile' || !args[2] || args.length !== 3) { console.error(help); return 1; }
    requiredProfile = args[2];
  } else if (!benchmark && args.length > 0) { console.error(`ERROR unknown argument: ${args[0]}`); console.error(help); return 1; }

  await mkdirFn(benchmark ? resolve(root, '.metrics') : profileDir, { recursive: true });
  const childArgs = benchmark
    ? ['scripts/validate-all.mjs', '--full', '--no-cache', '--write-timings', '--output-json', reportPath]
    : ['--cpu-prof', '--cpu-prof-dir', profileDir, 'scripts/validate-all.mjs', '--full', '--no-cache', '--write-timings'];
  const result = await runner(benchmark ? 'benchmark validate-all' : 'profile validate-all', process.execPath, childArgs, {
    cwd: root, capture: false, timeoutMs: 180_000,
    env: { ...process.env, NOVA_VALIDATION_SCENARIO: benchmark ? 'fresh-process-full-uncached' : 'cpu-profile' },
  });
  if (!result.ok) { console.error(`ERROR validate-all child: ${result.errorMessage ?? result.code}`); return result.code ?? 1; }
  if (benchmark) {
    const validateArgs = ['scripts/validate-performance-budget.mjs', reportPath];
    if (requiredProfile) validateArgs.push('--require-profile', requiredProfile, '--verify-github');
    const validation = await runner('validate observed performance', process.execPath, validateArgs, { cwd: root, capture: false, timeoutMs: 30_000 });
    if (!validation.ok) { console.error(`ERROR observed performance: ${validation.errorMessage ?? validation.code}`); return validation.code ?? 1; }
    console.log('\nWrote non-source-controlled benchmark evidence under .metrics/.');
  } else console.log('\nWrote non-comparable CPU profile under .metrics/.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();

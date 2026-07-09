#!/usr/bin/env node
/**
 * Run the Node test suite with built-in coverage and write disposable evidence
 * under .metrics/coverage/.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assertNodeVersion } from './lib/node-version.mjs';

assertNodeVersion({ label: 'test coverage' });

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function usage() {
  return `Usage: node scripts/run-test-coverage.mjs [--check] [--coverage-dir <path>]

Runs node --test --experimental-test-coverage for the repository test suite.
Coverage output is local runtime evidence and is written under .metrics/ by
default. --check verifies coverage collection and test success; percentage
thresholds are intentionally opt-in until CI records a stable baseline.

Optional threshold environment variables:
  NOVA_COVERAGE_LINES
  NOVA_COVERAGE_BRANCHES
  NOVA_COVERAGE_FUNCTIONS`;
}

function parseArgs(args) {
  const options = {
    check: false,
    coverageDir: resolve(root, '.metrics/coverage'),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--check') {
      options.check = true;
      continue;
    }
    if (arg === '--coverage-dir') {
      const value = args[index + 1];
      if (!value) {
        console.error('ERROR --coverage-dir requires a path');
        console.error(usage());
        process.exit(1);
      }
      options.coverageDir = resolve(root, value);
      index += 1;
      continue;
    }
    console.error(`ERROR unknown argument: ${arg}`);
    console.error(usage());
    process.exit(1);
  }

  return options;
}

function thresholdFlag(envName, flagName) {
  const value = process.env[envName];
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    console.error(`ERROR ${envName} must be a percentage between 0 and 100`);
    process.exit(1);
  }
  return `${flagName}=${value}`;
}

const options = parseArgs(process.argv.slice(2));
const v8Dir = resolve(options.coverageDir, 'v8');
const summaryPath = resolve(options.coverageDir, 'coverage-summary.txt');
const metadataPath = resolve(options.coverageDir, 'metadata.json');
const thresholds = [
  thresholdFlag('NOVA_COVERAGE_LINES', '--test-coverage-lines'),
  thresholdFlag('NOVA_COVERAGE_BRANCHES', '--test-coverage-branches'),
  thresholdFlag('NOVA_COVERAGE_FUNCTIONS', '--test-coverage-functions'),
].filter(Boolean);

rmSync(options.coverageDir, { recursive: true, force: true });
mkdirSync(v8Dir, { recursive: true });

const args = [
  '--test',
  '--experimental-test-coverage',
  ...thresholds,
  'tests/**/*.test.mjs',
];

console.log(`Running coverage command: ${process.execPath} ${args.join(' ')}`);
console.log(`Coverage evidence directory: ${relative(root, options.coverageDir)}`);
if (thresholds.length === 0) {
  console.log('Coverage thresholds: not enforced; collection-only mode is active.');
} else {
  console.log(`Coverage thresholds: ${thresholds.join(' ')}`);
}

const startedAt = new Date().toISOString();
const result = spawnSync(process.execPath, args, {
  cwd: root,
  env: {
    ...process.env,
    NODE_V8_COVERAGE: v8Dir,
  },
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
  shell: false,
});
const completedAt = new Date().toISOString();
const stdout = result.stdout ?? '';
const stderr = result.stderr ?? '';

if (stdout) process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);

writeFileSync(
  summaryPath,
  [
    `command=${process.execPath} ${args.join(' ')}`,
    `check=${options.check}`,
    `thresholds=${thresholds.length ? thresholds.join(' ') : 'not enforced'}`,
    `exitCode=${result.status ?? 'null'}`,
    `signal=${result.signal ?? ''}`,
    `startedAt=${startedAt}`,
    `completedAt=${completedAt}`,
    '',
    '--- stdout ---',
    stdout,
    '',
    '--- stderr ---',
    stderr,
  ].join('\n'),
  'utf8',
);

writeFileSync(
  metadataPath,
  `${JSON.stringify({
    command: [process.execPath, ...args],
    check: options.check,
    thresholds,
    exitCode: result.status,
    signal: result.signal,
    startedAt,
    completedAt,
    coverageDir: relative(root, options.coverageDir).replaceAll('\\', '/'),
    v8Dir: relative(root, v8Dir).replaceAll('\\', '/'),
    summaryPath: relative(root, summaryPath).replaceAll('\\', '/'),
    node: process.version,
  }, null, 2)}\n`,
  'utf8',
);

if (result.error) {
  console.error(`ERROR failed to run coverage command: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (options.check && !stdout.includes('start of coverage report')) {
  console.error('ERROR coverage report marker was not found in test output');
  process.exit(1);
}

if (options.check) {
  const coverageFiles = readdirSync(v8Dir).filter((entry) => entry.endsWith('.json'));
  if (coverageFiles.length === 0) {
    console.error('ERROR NODE_V8_COVERAGE did not produce raw coverage JSON');
    process.exit(1);
  }
}

console.log(`Coverage evidence written to ${relative(root, options.coverageDir)}`);

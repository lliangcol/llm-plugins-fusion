#!/usr/bin/env node
/** Run repository Node tests using explicit, Node 20-compatible discovery. */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { relativeTestFiles, TEST_SUITES } from './lib/test-discovery.mjs';

assertNodeVersion({ label: 'node tests' });

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function usage() {
  return 'Usage: node scripts/run-node-tests.mjs [--suite unit|integration|e2e|all]';
}

function parseArgs(args) {
  let suite = 'all';
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }
    if (arg === '--suite') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        console.error('ERROR --suite requires a value');
        console.error(usage());
        process.exit(1);
      }
      suite = value;
      index += 1;
      continue;
    }
    console.error(`ERROR unknown argument: ${arg}`);
    console.error(usage());
    process.exit(1);
  }

  if (!TEST_SUITES.has(suite)) {
    console.error(`ERROR unknown test suite: ${suite}`);
    console.error(usage());
    process.exit(1);
  }
  return suite;
}

const suite = parseArgs(process.argv.slice(2));
const testFiles = relativeTestFiles(root, suite);
if (testFiles.length === 0) {
  console.error(`ERROR no test files found for suite: ${suite}`);
  process.exit(1);
}

console.log(`Running ${testFiles.length} explicit test file(s) for suite: ${suite}`);
const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error(`ERROR failed to run tests: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

#!/usr/bin/env node
/** Run repository Node tests using explicit, Node 20-compatible discovery. */

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertNodeVersion } from './lib/node-version.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';
import { relativeTestFiles, TEST_SUITES } from './lib/test-discovery.mjs';

assertNodeVersion({ label: 'node tests' });

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

function usage() {
  return 'Usage: node scripts/run-node-tests.mjs [--suite unit|integration|e2e|all]';
}

export function parseArgs(args) {
  let suite = 'all';
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      return { help: true, suite };
    }
    if (arg === '--suite') {
      const value = requireOptionValue(args, index, '--suite');
      suite = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  if (!TEST_SUITES.has(suite)) {
    throw new Error(`unknown test suite: ${suite}`);
  }
  return { help: false, suite };
}

export function main({ args = process.argv.slice(2), runner = spawnSync } = {}) {
  let parsed;
  try {
    parsed = parseArgs(args);
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    console.error(usage());
    return 1;
  }
  if (parsed.help) {
    console.log(usage());
    return 0;
  }
  const testFiles = relativeTestFiles(root, parsed.suite);
  if (testFiles.length === 0) {
    console.error(`ERROR no test files found for suite: ${parsed.suite}`);
    return 1;
  }
  console.log(`Running ${testFiles.length} explicit test file(s) for suite: ${parsed.suite}`);
  const result = runner(process.execPath, ['--test', ...testFiles], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    console.error(`ERROR failed to run tests: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}

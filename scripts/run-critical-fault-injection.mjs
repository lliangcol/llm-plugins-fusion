#!/usr/bin/env node
/** Aggregate the fault-injection tests that protect critical runtime boundaries. */

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const files = [
  'tests/unit/process-runner.test.mjs',
  'tests/unit/safe-workspace-path.test.mjs',
  'tests/integration/audit-log-rotation.test.mjs',
  'tests/integration/pre-write-hook.test.mjs',
  'tests/integration/post-write-verify.test.mjs',
  'tests/integration/release-candidate.test.mjs',
];
export function main(args = process.argv.slice(2), runner = spawnSync) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/run-critical-fault-injection.mjs');
    return 0;
  }
  if (args.length) {
    console.error('Usage: node scripts/run-critical-fault-injection.mjs');
    return 1;
  }
  const result = runner(process.execPath, ['--test', ...files], { cwd: root, encoding: 'utf8', shell: false, maxBuffer: 20 * 1024 * 1024 });
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) {
    console.error(`ERROR fault-injection runner failed: ${result.error.message}`);
    return 1;
  }
  if (result.status === 0) console.log(`OK critical fault injection (${files.length} suites)`);
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();

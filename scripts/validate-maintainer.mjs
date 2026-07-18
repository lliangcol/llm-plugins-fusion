#!/usr/bin/env node
/**
 * Maintainer validation wrapper for release-facing local work.
 *
 * This stays separate from validate-all because it also checks generated
 * registry drift and whitespace in the working tree.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withoutGithubCredentials } from './lib/credential-environment.mjs';
import { assertNodeVersion } from './lib/node-version.mjs';
import { runProcess } from './lib/process-runner.mjs';

assertNodeVersion({ label: 'maintainer validation' });

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

export function npmInvocation({
  platform = process.platform,
  env = process.env,
  nodeExecutable = process.execPath,
} = {}) {
  // Node 24 rejects direct `.cmd` execution with `spawn EINVAL` on Windows.
  // npm exposes its JavaScript entry point to child scripts, so execute that
  // entry point with the current Node binary and keep shell execution disabled.
  if (platform === 'win32' && env.npm_execpath) {
    return { command: nodeExecutable, argsPrefix: [env.npm_execpath] };
  }
  return { command: 'npm', argsPrefix: [] };
}

export async function main({ platform = process.platform, runner = runProcess, runTestGates = true, env = process.env } = {}) {
  let failed = 0;
  const credentialFreeEnv = withoutGithubCredentials(env);
  async function run(label, command, args = [], childEnv = credentialFreeEnv) {
    console.log(`\n== ${label} ==`);
    const result = await runner(label, command, args, {
      cwd: root,
      capture: false,
      timeoutMs: 180_000,
      env: childEnv,
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

  const npm = npmInvocation({ platform, env });
  if (runTestGates) {
    await run('npm run test:unit', npm.command, [...npm.argsPrefix, 'run', 'test:unit']);
    await run('npm run test:integration', npm.command, [...npm.argsPrefix, 'run', 'test:integration']);
    await run('npm run test:e2e', npm.command, [...npm.argsPrefix, 'run', 'test:e2e']);
    const benchmarkArgs = ['scripts/profile-validation.mjs', '--benchmark'];
    const requiredProfile = env.NOVA_REQUIRED_VALIDATION_PROFILE?.trim();
    if (requiredProfile) benchmarkArgs.push('--require-profile', requiredProfile);
    // The benchmark wrapper alone receives the token for its explicit external
    // provenance request; it strips credentials before spawning validate-all.
    await run('benchmark validate all', process.execPath, benchmarkArgs, env);
  }
  await run('generated registry drift check', process.execPath, ['scripts/generate-registry.mjs']);
  await run('git diff --check', 'git', ['diff', '--check']);
  await run('git diff --cached --check', 'git', ['diff', '--cached', '--check']);

  console.log(`\nSummary: failed=${failed}`);
  return failed === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--evidence-only')) {
    console.error('Usage: node scripts/validate-maintainer.mjs [--evidence-only]');
    process.exitCode = 1;
  } else {
    process.exitCode = await main({ runTestGates: !args.includes('--evidence-only') });
  }
}

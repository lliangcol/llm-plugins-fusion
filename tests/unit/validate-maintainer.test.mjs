import assert from 'node:assert/strict';
import test from 'node:test';
import { main, npmInvocation } from '../../scripts/validate-maintainer.mjs';

test('maintainer validation selects npm without a shell on every platform', async () => {
  assert.deepEqual(
    npmInvocation({ platform: 'win32', env: { npm_execpath: 'C:\\npm-cli.js' }, nodeExecutable: 'C:\\node.exe' }),
    { command: 'C:\\node.exe', argsPrefix: ['C:\\npm-cli.js'] },
  );
  assert.deepEqual(npmInvocation({ platform: 'linux', env: {} }), { command: 'npm', argsPrefix: [] });
  const calls = [];
  const status = await main({
    platform: 'win32',
    runner: async (label, command, args, options) => {
      calls.push({ label, command, args, options });
      return { ok: true, code: 0 };
    },
  });
  assert.equal(status, 0);
  const npmExecPath = process.env.npm_execpath;
  const expectedCommand = npmExecPath ? process.execPath : 'npm';
  const prefix = npmExecPath ? [npmExecPath] : [];
  assert.deepEqual(calls.slice(0, 3).map(({ command, args }) => [command, args]), [
    [expectedCommand, [...prefix, 'run', 'test:unit']],
    [expectedCommand, [...prefix, 'run', 'test:integration']],
    [expectedCommand, [...prefix, 'run', 'test:e2e']],
  ]);
  assert.deepEqual(calls.find(({ label }) => label === 'benchmark validate all').args, ['scripts/profile-validation.mjs', '--benchmark']);
  assert.ok(calls.every(({ options }) => !Object.hasOwn(options, 'shell')));
});

test('candidate validation forwards an exact required performance profile', async () => {
  const calls = [];
  const profile = 'linux-x64-node22-github-hosted-3-fresh-process-full-uncached';
  const status = await main({
    env: { ...process.env, NOVA_REQUIRED_VALIDATION_PROFILE: profile, GH_TOKEN: 'gh-secret', GITHUB_TOKEN: 'github-secret' },
    runner: async (label, command, args, options) => {
      calls.push({ label, command, args, options });
      return { ok: true, code: 0 };
    },
  });
  assert.equal(status, 0);
  assert.deepEqual(calls.find(({ label }) => label === 'benchmark validate all').args, ['scripts/profile-validation.mjs', '--benchmark', '--require-profile', profile]);
  for (const call of calls) {
    if (call.label === 'benchmark validate all') {
      assert.equal(call.options.env.GH_TOKEN, 'gh-secret');
      assert.equal(call.options.env.GITHUB_TOKEN, 'github-secret');
    } else {
      assert.equal(Object.hasOwn(call.options.env, 'GH_TOKEN'), false);
      assert.equal(Object.hasOwn(call.options.env, 'GITHUB_TOKEN'), false);
    }
  }
});

test('maintainer evidence-only mode reuses prior test evidence without rerunning suites', async () => {
  const calls = [];
  const status = await main({
    runTestGates: false,
    runner: async (label, command, args, options) => {
      calls.push({ label, command, args, options });
      return { ok: true, code: 0 };
    },
  });
  assert.equal(status, 0);
  assert.deepEqual(calls.map(({ label }) => label), [
    'generated registry drift check',
    'git diff --check',
    'git diff --cached --check',
  ]);
});

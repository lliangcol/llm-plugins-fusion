import assert from 'node:assert/strict';
import test from 'node:test';
import { main, npmExecutable } from '../../scripts/validate-maintainer.mjs';

test('maintainer validation selects npm without a shell on every platform', async () => {
  assert.equal(npmExecutable('win32'), 'npm.cmd');
  assert.equal(npmExecutable('linux'), 'npm');
  const calls = [];
  const status = await main({
    platform: 'win32',
    runner: async (label, command, args, options) => {
      calls.push({ label, command, args, options });
      return { ok: true, code: 0 };
    },
  });
  assert.equal(status, 0);
  assert.deepEqual(calls.slice(0, 3).map(({ command, args }) => [command, args]), [
    ['npm.cmd', ['run', 'test:unit']],
    ['npm.cmd', ['run', 'test:integration']],
    ['npm.cmd', ['run', 'test:e2e']],
  ]);
  assert.ok(calls.every(({ options }) => !Object.hasOwn(options, 'shell')));
});

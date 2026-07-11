import assert from 'node:assert/strict';
import test from 'node:test';
import { main as profileMain } from '../../scripts/profile-validation.mjs';
import { main as testMain, parseArgs } from '../../scripts/run-node-tests.mjs';

test('node test runner parses suites and rejects malformed options', () => {
  assert.deepEqual(parseArgs(['--suite', 'unit']), { help: false, suite: 'unit' });
  assert.deepEqual(parseArgs(['--help']), { help: true, suite: 'all' });
  assert.throws(() => parseArgs(['--suite', '--help']), /requires a value/);
  assert.throws(() => parseArgs(['--suite', 'unknown']), /unknown test suite/);
});

test('node test runner invokes Node without a shell', () => {
  const calls = [];
  const status = testMain({
    args: ['--suite', 'unit'],
    runner: (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0 };
    },
  });
  assert.equal(status, 0);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].args[0], '--test');
});

test('profile runner exposes injected process and filesystem boundaries', async () => {
  const calls = [];
  const status = await profileMain({
    args: [],
    mkdirFn: async (...args) => calls.push(['mkdir', ...args]),
    runner: async (...args) => {
      calls.push(['run', ...args]);
      return { ok: true, code: 0 };
    },
  });
  assert.equal(status, 0);
  assert.equal(calls[0][0], 'mkdir');
  assert.equal(calls[1][0], 'run');
});

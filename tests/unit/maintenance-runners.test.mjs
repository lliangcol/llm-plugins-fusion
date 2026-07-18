import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { main as profileMain } from '../../scripts/profile-validation.mjs';
import { main as testMain, parseArgs } from '../../scripts/run-node-tests.mjs';
import { main as timingMain, timingTrend } from '../../scripts/generate-validation-timing-trend.mjs';

test('node test runner parses suites and rejects malformed options', () => {
  assert.deepEqual(parseArgs(['--suite', 'unit']), { help: false, suite: 'unit' });
  assert.deepEqual(parseArgs(['--help']), { help: true, suite: 'all' });
  assert.throws(() => parseArgs(['--suite', '--help']), /requires a value/);
  assert.throws(() => parseArgs(['--suite', 'unknown']), /unknown test suite/);
});

test('validation timing trend normalizes gate durations without changing outcomes', () => {
  const record = { runId: 'run-1', generatedAt: '2026-07-13T00:00:00Z', failed: 0, skipped: 1, gates: [{ id: 'a', status: 'passed', durationMs: 12 }, { id: 'b', status: 'skipped', durationMs: 3 }] };
  const trend = timingTrend([record]);
  assert.equal(trend.runCount, 1);
  assert.deepEqual(trend.gateIds, ['a', 'b']);
  assert.equal(trend.runs[0].totalDurationMs, 15);
  assert.equal(trend.runs[0].skipped, 1);

  const directory = mkdtempSync(resolve(tmpdir(), 'validation-timing-trend-'));
  try {
    const input = resolve(directory, 'timing.json');
    const output = resolve(directory, 'trend.json');
    writeFileSync(input, `${JSON.stringify(record)}\n`);
    timingMain(['--input', input, '--output', output]);
    assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), trend);
    assert.throws(() => timingMain(['--input', input]), /Usage:/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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

test('benchmark profile runner withholds GitHub credentials from validate-all only', async () => {
  const calls = [];
  const env = { PATH: process.env.PATH, GH_TOKEN: 'gh-secret', GITHUB_TOKEN: 'github-secret' };
  const status = await profileMain({
    args: ['--benchmark', '--require-profile', 'profile-id'],
    env,
    mkdirFn: async () => {},
    runner: async (label, command, args, options) => {
      calls.push({ label, command, args, options });
      return { ok: true, code: 0 };
    },
  });
  assert.equal(status, 0);
  assert.deepEqual(calls.map(({ label }) => label), ['benchmark validate-all', 'validate observed performance']);
  assert.equal(Object.hasOwn(calls[0].options.env, 'GH_TOKEN'), false);
  assert.equal(Object.hasOwn(calls[0].options.env, 'GITHUB_TOKEN'), false);
  assert.equal(calls[1].options.env.GH_TOKEN, 'gh-secret');
  assert.equal(calls[1].options.env.GITHUB_TOKEN, 'github-secret');
});

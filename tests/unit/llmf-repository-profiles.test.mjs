import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  EXIT,
  parseRepositoryCommandArgs,
  repositoryProfilePlan,
  runCli,
} from '../../packages/cli/index.mjs';

const root = resolve(import.meta.dirname, '../..');

function observed({ ok = true, code = 0, id = 'task' } = {}) {
  return {
    label: id,
    ok,
    code,
    signal: null,
    timedOut: false,
    ms: 1,
    stdout: ok ? 'passed\n' : '',
    stderr: ok ? '' : 'failed safely\n',
    stdoutTruncated: false,
    stderrTruncated: false,
    errorMessage: null,
  };
}

test('llmf repository profile parser is strict and keeps write mode generate-only', () => {
  assert.deepEqual(
    parseRepositoryCommandArgs('check', ['check', 'quick', '--root', root]),
    { profile: 'quick', root, write: false },
  );
  assert.deepEqual(
    parseRepositoryCommandArgs('generate', ['generate', '--write', 'docs', '--root', root]),
    { profile: 'docs', root, write: true },
  );
  for (const args of [
    ['check'],
    ['check', 'all'],
    ['check', 'quick', '--write'],
    ['check', 'quick', '--unknown'],
    ['check', 'quick', 'full'],
    ['check', 'quick', '--root'],
    ['check', 'quick', '--root', root, '--root', root],
  ]) assert.throws(() => parseRepositoryCommandArgs('check', args), { exitCode: EXIT.USAGE });
  assert.throws(
    () => parseRepositoryCommandArgs('generate', ['generate', 'unknown']),
    { exitCode: EXIT.USAGE },
  );
});

test('llmf repository plans use fixed argv without shell composition', () => {
  assert.deepEqual(
    repositoryProfilePlan('check', 'quick').map((entry) => entry.args[0]),
    [
      'scripts/validate-schemas.mjs',
      'scripts/lint-frontmatter.mjs',
      'scripts/validate-docs.mjs',
      'scripts/validate-hooks.mjs',
    ],
  );
  const release = repositoryProfilePlan('check', 'release');
  assert.deepEqual(release.map((entry) => entry.id), ['coverage', 'maintainer-evidence', 'install-preview']);
  const security = repositoryProfilePlan('check', 'security');
  assert.deepEqual(
    security.map((entry) => entry.command),
    [process.execPath, 'shellcheck', 'actionlint', process.execPath, process.execPath],
  );
  assert.ok(security.every((entry) => entry.command !== 'npm'));

  const drift = repositoryProfilePlan('generate', 'all');
  const write = repositoryProfilePlan('generate', 'all', { write: true });
  assert.equal(drift.length, 19);
  assert.equal(write.length, drift.length);
  assert.ok(drift.every((entry) => !entry.args.includes('--write')));
  assert.ok(write.every((entry) => entry.args.at(-1) === '--write'));
  for (const entry of [...drift, ...release, ...security]) {
    assert.equal(typeof entry.command, 'string');
    assert.ok(entry.args.every((arg) => !/[;&|`]/u.test(arg)), `${entry.id} contains shell syntax`);
  }
});

test('llmf repository checks execute sequentially and fail closed with normalized evidence', async () => {
  const calls = [];
  const runner = async (id, command, args, options) => {
    calls.push({ id, command, args, options });
    return observed({ id });
  };
  const passed = await runCli(['check', 'quick', '--root', root], process, { runner });
  assert.equal(passed.exitCode, EXIT.OK);
  assert.equal(passed.output.result.passed, true);
  assert.equal(passed.output.result.tasks.length, 4);
  assert.deepEqual(calls.map((entry) => entry.id), ['schemas', 'frontmatter', 'docs', 'hooks']);
  assert.ok(calls.every((entry) => entry.options.capture === true && !Object.hasOwn(entry.options, 'shell')));

  let attempt = 0;
  const failure = await runCli(['generate', 'docs', '--root', root], process, {
    runner: async (id) => {
      attempt += 1;
      return observed({ id, ok: attempt !== 2, code: attempt === 2 ? 1 : 0 });
    },
  });
  assert.equal(failure.exitCode, EXIT.VALIDATION);
  assert.equal(failure.output.ok, false);
  assert.equal(failure.output.result.passed, false);
  assert.equal(failure.output.result.tasks.length, 2);
  assert.equal(failure.output.result.tasks[1].stderr, 'failed safely\n');
});

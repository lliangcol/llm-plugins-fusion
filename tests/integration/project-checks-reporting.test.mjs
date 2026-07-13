import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { pathForBash, resolveBashCommand } from '../../scripts/lib/bash-command.mjs';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const checksScript = resolve(repoRoot, 'nova-plugin/skills/nova-codex-review-fix/scripts/run-project-checks.sh');
const bashCommand = resolveBashCommand();

async function fixtureRepo(t, packages) {
  const root = await mkdtemp(join(tmpdir(), 'nova-project-checks-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const init = await runProcess('git init', 'git', ['init', '--quiet'], { cwd: root });
  assert.equal(init.ok, true, init.stderr);
  for (const [directory, script] of packages) {
    await mkdir(resolve(root, directory), { recursive: true });
    await writeFile(
      resolve(root, directory, 'package.json'),
      `${JSON.stringify({
        private: true,
        scripts: typeof script === 'string' ? { test: script } : script,
      }, null, 2)}\n`,
      'utf8',
    );
  }
  return root;
}

test('project checks reports an executed all-failure task accurately', async (t) => {
  const root = await fixtureRepo(t, [['.', `${process.execPath} -e "process.exit(7)"`]]);
  const result = await runProcess('all-failure checks', bashCommand, [pathForBash(checksScript, bashCommand), '--test-only'], {
    cwd: root,
    timeoutMs: 60_000,
  });
  assert.equal(result.ok, false);
  assert.match(`${result.stdout}${result.stderr}`, /Summary: selected=1 passed=0 failed=1 mode=test/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /没有发现可执行任务/);
});

test('project checks reports an all-success task accurately', async (t) => {
  const root = await fixtureRepo(t, [['.', `${process.execPath} -e "process.exit(0)"`]]);
  const result = await runProcess('all-success checks', bashCommand, [pathForBash(checksScript, bashCommand), '--test-only'], {
    cwd: root,
    timeoutMs: 60_000,
  });
  assert.equal(result.ok, true, result.stderr);
  assert.match(`${result.stdout}${result.stderr}`, /Summary: selected=1 passed=1 failed=0 mode=test/);
});

test('project checks reports mixed success and failure counts', async (t) => {
  const root = await fixtureRepo(t, [
    ['.', `${process.execPath} -e "process.exit(0)"`],
    ['packages/fail', `${process.execPath} -e "process.exit(9)"`],
  ]);
  const result = await runProcess('mixed checks', bashCommand, [pathForBash(checksScript, bashCommand), '--test-only'], {
    cwd: root,
    timeoutMs: 60_000,
  });
  assert.equal(result.ok, false);
  assert.match(`${result.stdout}${result.stderr}`, /Summary: selected=2 passed=1 failed=1 mode=test/);
});

test('project checks uses no-task messaging only when the selected phase is empty', async (t) => {
  const root = await fixtureRepo(t, [[
    '.',
    { lint: `${process.execPath} -e "process.exit(0)"` },
  ]]);
  const result = await runProcess('empty checks', bashCommand, [pathForBash(checksScript, bashCommand), '--test-only'], {
    cwd: root,
    timeoutMs: 60_000,
  });
  assert.equal(result.ok, false);
  assert.match(`${result.stdout}${result.stderr}`, /没有发现可执行任务/);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /Summary:/);
});

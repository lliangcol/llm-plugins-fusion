import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const cli = resolve(repo, 'packages/cli/bin/llmf.mjs');

async function invoke(args) {
  const result = await runProcess(`llmf ${args[0]}`, process.execPath, [cli, ...args], { cwd: repo });
  return { ...result, exitCode: result.code, json: JSON.parse(result.stdout || result.stderr) };
}

test('llmf preview exposes stable JSON commands and builds the second product without product constants', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-second-product-'));
  await cp(resolve(repo, 'fixtures/products/minimal-plugin'), root, { recursive: true });
  for (const command of ['validate', 'test', 'eval', 'doctor', 'inspect']) {
    const result = await invoke([command, '--root', root]);
    assert.equal(result.exitCode, 0, `${command}: ${result.stderr}`);
    assert.equal(result.json.ok, true);
    assert.equal(result.json.command, command);
  }
  const build = await invoke(['build', '--root', root, '--out', 'dist/bundle.json']);
  assert.equal(build.exitCode, 0);
  const artifact = await readFile(resolve(root, 'dist/bundle.json'), 'utf8');
  assert.doesNotMatch(artifact, /nova|claude|codex/iu);
  const migrate = await invoke(['migrate', '--root', root, '--write']);
  assert.equal(migrate.exitCode, 0);
  assert.equal(migrate.json.result.workflowSchemaVersion, 6);
});

test('llmf init is portable and usage failures have stable exit code 2', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'llmf-init-'));
  const initialized = await invoke(['init', '--root', root]);
  assert.equal(initialized.exitCode, 0);
  assert.equal((await invoke(['validate', '--root', root])).exitCode, 0);
  const unknown = await invoke(['unknown']);
  assert.equal(unknown.exitCode, 2);
  assert.deepEqual(unknown.json, { ok: false, command: 'unknown', error: 'unknown-command' });
});

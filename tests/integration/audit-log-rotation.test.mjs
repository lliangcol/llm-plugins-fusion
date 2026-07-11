import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const payload = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'README.md' } });
const notebookPayload = JSON.stringify({
  tool_name: 'NotebookEdit',
  tool_input: { notebook_path: 'analysis.ipynb', cell_id: 'cell-1', new_source: 'print("changed")' },
});

async function blockedRotationRoot(t) {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-rotation-'));
  t.after(async () => {
    await chmod(join(root, 'audit.log.1'), 0o700).catch(() => {});
    await rm(root, { recursive: true, force: true });
  });
  await writeFile(join(root, 'audit.log'), Buffer.alloc(5_242_881, 'x'));
  await mkdir(join(root, 'audit.log.1'));
  await chmod(join(root, 'audit.log.1'), 0o500);
  return root;
}

async function normalRotationRoot(t) {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-rotation-ok-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'audit.log'), Buffer.alloc(5_242_881, 'x'));
  return root;
}

for (const [label, command, args] of [
  ['Bash', 'bash', ['nova-plugin/hooks/scripts/post-audit-log.sh']],
  ['Node', process.execPath, ['nova-plugin/hooks/scripts/post-audit-log.mjs']],
]) {
  test(`${label} audit rotation creates a fresh log only after a successful rename`, async (t) => {
    const root = await normalRotationRoot(t);
    const before = (await stat(join(root, 'audit.log'))).size;
    const result = await runProcess(`${label} audit rotation`, command, args, {
      cwd: repoRoot,
      env: { ...process.env, CLAUDE_PLUGIN_DATA: root },
      input: payload,
    });
    assert.equal(result.ok, true, result.stderr);
    assert.equal((await stat(join(root, 'audit.log.1'))).size, before);
    assert.match(await readFile(join(root, 'audit.log'), 'utf8'), /Write\s+SUCCESS\s+README\.md/);
  });

  test(`${label} audit rotation preserves the active log when the target is a directory`, async (t) => {
    const root = await blockedRotationRoot(t);
    const before = (await stat(join(root, 'audit.log'))).size;
    const result = await runProcess(`${label} audit rotation`, command, args, {
      cwd: repoRoot,
      env: { ...process.env, CLAUDE_PLUGIN_DATA: root },
      input: payload,
    });
    assert.equal(result.ok, true, result.stderr);
    const after = (await stat(join(root, 'audit.log'))).size;
    assert.ok(after >= before, `expected ${after} >= ${before}`);
  });

  test(`${label} audit logger records NotebookEdit notebook paths`, async (t) => {
    const root = await mkdtemp(join(tmpdir(), 'nova-audit-notebook-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const result = await runProcess(`${label} NotebookEdit audit`, command, args, {
      cwd: repoRoot,
      env: { ...process.env, CLAUDE_PLUGIN_DATA: root },
      input: notebookPayload,
    });
    assert.equal(result.ok, true, result.stderr);
    assert.match(await readFile(join(root, 'audit.log'), 'utf8'), /NotebookEdit\s+SUCCESS\s+analysis\.ipynb/);
  });

}

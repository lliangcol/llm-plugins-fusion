import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const payload = JSON.stringify({
  hook_event_name: 'PostToolUse',
  session_id: 'session-1',
  tool_use_id: 'tool-1',
  tool_name: 'Write',
  tool_input: { file_path: 'README.md' },
  tool_response: { success: true },
});
const notebookPayload = JSON.stringify({
  hook_event_name: 'PostToolUse',
  tool_name: 'NotebookEdit',
  tool_input: { notebook_path: 'analysis.ipynb', cell_id: 'cell-1', new_source: 'print("changed")' },
  tool_response: { success: true },
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
    const record = JSON.parse((await readFile(join(root, 'audit.log'), 'utf8')).trim());
    assert.equal(record.schemaVersion, 3);
    assert.equal(record.tool, 'Write');
    assert.equal(record.outcome, 'success');
    assert.equal(record.summary, 'README.md');
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
    const record = JSON.parse((await readFile(join(root, 'audit.log'), 'utf8')).trim());
    assert.equal(record.tool, 'NotebookEdit');
    assert.equal(record.outcome, 'success');
    assert.equal(record.summary, 'analysis.ipynb');
  });

}

test('concurrent audit writers preserve every atomic spool record', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-concurrent-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runs = Array.from({ length: 12 }, (_, index) => runProcess(`concurrent audit ${index}`, process.execPath, ['nova-plugin/hooks/scripts/post-audit-log.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PLUGIN_DATA: root },
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      session_id: 'session-concurrent',
      tool_use_id: `tool-${index}`,
      tool_name: 'Write',
      tool_input: { file_path: `fixtures/${index}.txt` },
      tool_response: { success: true },
    }),
  }));
  const results = await Promise.all(runs);
  assert.equal(results.every((entry) => entry.ok), true);
  const finalCompact = await runProcess('final audit compaction', process.execPath, ['nova-plugin/hooks/scripts/audit-compactor.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PLUGIN_DATA: root },
  });
  assert.equal(finalCompact.ok, true, finalCompact.stderr);
  const records = (await readFile(join(root, 'audit.log'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(records.length, 12);
  assert.equal(new Set(records.map((record) => record.toolUseId)).size, 12);
  assert.equal(new Set(records.map((record) => record.sequence)).size, 12);
});

test('audit compactor exits cleanly when another process owns the lock', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-locked-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.audit-compact.lock'));
  const result = await runProcess('locked audit compaction', process.execPath, ['nova-plugin/hooks/scripts/audit-compactor.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PLUGIN_DATA: root },
  });
  assert.equal(result.ok, true, result.stderr);
  await assert.rejects(() => stat(join(root, 'audit.log')), { code: 'ENOENT' });
});

test('audit compactor recovers an expired lock owned by a dead process', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-stale-lock-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const lock = join(root, '.audit-compact.lock');
  const spool = join(root, 'audit-spool');
  await mkdir(lock);
  await mkdir(spool);
  await writeFile(join(lock, 'owner.json'), JSON.stringify({ pid: 99999999, startedAt: '2020-01-01T00:00:00.000Z', host: 'stale', processStartIdentity: 'stale' }));
  await utimes(lock, new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'));
  await writeFile(join(spool, 'record.json'), '{"schemaVersion":3,"tool":"Write"}\n');
  const result = await runProcess('stale lock recovery', process.execPath, ['nova-plugin/hooks/scripts/audit-compactor.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PLUGIN_DATA: root, NOVA_AUDIT_LOCK_TTL_MS: '1' },
  });
  assert.equal(result.ok, true, result.stderr);
  assert.match(await readFile(join(root, 'audit.log'), 'utf8'), /"tool":"Write"/);
  assert.match(await readFile(join(root, 'audit-health.log'), 'utf8'), /recovered stale audit compaction lock/);
  await assert.rejects(() => stat(lock), { code: 'ENOENT' });
});

test('audit compactor recovers an expired lock after PID reuse identity mismatch', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-reused-pid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const lock = join(root, '.audit-compact.lock');
  const spool = join(root, 'audit-spool');
  await mkdir(lock);
  await mkdir(spool);
  await writeFile(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: '2020-01-01T00:00:00.000Z', host: 'stale', processStartIdentity: 'different-process-start' }));
  await writeFile(join(spool, 'record.json'), '{"schemaVersion":3,"tool":"Bash"}\n');
  const result = await runProcess('reused PID lock recovery', process.execPath, ['nova-plugin/hooks/scripts/audit-compactor.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PLUGIN_DATA: root, NOVA_AUDIT_LOCK_TTL_MS: '1' },
  });
  assert.equal(result.ok, true, result.stderr);
  assert.match(await readFile(join(root, 'audit.log'), 'utf8'), /"tool":"Bash"/);
});

test('audit logger hashes paths outside the project root', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-external-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await runProcess('external path audit', process.execPath, ['nova-plugin/hooks/scripts/post-audit-log.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PLUGIN_DATA: root },
    input: JSON.stringify({ ...JSON.parse(payload), cwd: repoRoot, tool_input: { file_path: resolve(tmpdir(), 'private-consumer/file.txt') } }),
  });
  assert.equal(result.ok, true, result.stderr);
  const record = JSON.parse((await readFile(join(root, 'audit.log'), 'utf8')).trim());
  assert.match(record.summary, /^external-path:[a-f0-9]{16}$/);
  assert.equal(record.summary.includes(tmpdir()), false);
});

test('audit logger distinguishes failed, denied, and unknown outcomes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-outcomes-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [event, outcome] of [
    ['PostToolUseFailure', 'failed'],
    ['PermissionDenied', 'denied'],
    ['UnexpectedEvent', 'unknown'],
  ]) {
    const result = await runProcess(`Node ${outcome} audit`, process.execPath, ['nova-plugin/hooks/scripts/post-audit-log.mjs'], {
      cwd: repoRoot,
      env: { ...process.env, CLAUDE_PLUGIN_DATA: root },
      input: JSON.stringify({ hook_event_name: event, tool_name: 'Bash', tool_input: { command: 'false' } }),
    });
    assert.equal(result.ok, true, result.stderr);
  }
  const records = (await readFile(join(root, 'audit.log'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(records.map((record) => record.outcome), ['failed', 'denied', 'unknown']);
});

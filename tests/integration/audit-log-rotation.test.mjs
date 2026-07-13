import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, link, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { resolveBashCommand } from '../../scripts/lib/bash-command.mjs';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bashCommand = resolveBashCommand();
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

async function compact(root, label = 'audit compaction') {
  return runProcess(label, process.execPath, ['nova-plugin/hooks/scripts/audit-compactor.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PLUGIN_DATA: root },
  });
}

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

test('audit compactor treats an absent spool as an empty queue', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await compact(root, 'empty audit compaction');
  assert.equal(result.ok, true, result.stderr);
  assert.equal((await readFile(join(root, 'audit.log'), 'utf8')), '');
  await assert.rejects(() => stat(join(root, 'audit-health.log')), { code: 'ENOENT' });
});

test('audit writer and compactor refuse a linked spool without touching the target', { skip: process.platform === 'win32' }, async (t) => {
  const writerRoot = await mkdtemp(join(tmpdir(), 'nova-audit-writer-link-'));
  const writerOutside = await mkdtemp(join(tmpdir(), 'nova-audit-writer-target-'));
  const compactRoot = await mkdtemp(join(tmpdir(), 'nova-audit-compact-link-'));
  const compactOutside = await mkdtemp(join(tmpdir(), 'nova-audit-compact-target-'));
  t.after(() => Promise.all([writerRoot, writerOutside, compactRoot, compactOutside].map((path) => rm(path, { recursive: true, force: true }))));
  await symlink(writerOutside, join(writerRoot, 'audit-spool'));
  const writeResult = await runProcess('linked spool audit writer', process.execPath, ['nova-plugin/hooks/scripts/post-audit-log.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PLUGIN_DATA: writerRoot },
    input: payload,
  });
  assert.equal(writeResult.ok, true, writeResult.stderr);
  assert.deepEqual(await readdir(writerOutside), []);

  await writeFile(join(compactOutside, 'victim.json'), '{"outside":true}\n');
  await symlink(compactOutside, join(compactRoot, 'audit-spool'));
  const compactResult = await compact(compactRoot, 'linked spool compaction');
  assert.equal(compactResult.ok, false);
  assert.equal(await readFile(join(compactOutside, 'victim.json'), 'utf8'), '{"outside":true}\n');
});

test('audit writer and compactor refuse a linked parent before creating plugin data', { skip: process.platform === 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-parent-link-'));
  const outside = await mkdtemp(join(tmpdir(), 'nova-audit-parent-target-'));
  t.after(() => Promise.all([root, outside].map((path) => rm(path, { recursive: true, force: true }))));
  await symlink(outside, join(root, 'linked-parent'));
  const pluginData = join(root, 'linked-parent', 'plugin-data');
  const writeResult = await runProcess('linked parent audit writer', process.execPath, ['nova-plugin/hooks/scripts/post-audit-log.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PLUGIN_DATA: pluginData },
    input: payload,
  });
  assert.equal(writeResult.ok, true, writeResult.stderr);
  assert.deepEqual(await readdir(outside), []);
  assert.equal((await compact(pluginData, 'linked parent compaction')).ok, false);
  assert.deepEqual(await readdir(outside), []);
});

test('audit compactor refuses linked log and spool record files', { skip: process.platform === 'win32' }, async (t) => {
  const logRoot = await mkdtemp(join(tmpdir(), 'nova-audit-log-link-'));
  const recordRoot = await mkdtemp(join(tmpdir(), 'nova-audit-record-link-'));
  const hardRoot = await mkdtemp(join(tmpdir(), 'nova-audit-record-hardlink-'));
  const outside = await mkdtemp(join(tmpdir(), 'nova-audit-linked-files-'));
  t.after(() => Promise.all([logRoot, recordRoot, hardRoot, outside].map((path) => rm(path, { recursive: true, force: true }))));

  await mkdir(join(logRoot, 'audit-spool'));
  await writeFile(join(logRoot, 'audit-spool', 'record.json'), '{}\n');
  const outsideLog = join(outside, 'outside.log');
  await writeFile(outsideLog, 'ORIGINAL\n');
  await symlink(outsideLog, join(logRoot, 'audit.log'));
  assert.equal((await compact(logRoot, 'linked audit log compaction')).ok, false);
  assert.equal(await readFile(outsideLog, 'utf8'), 'ORIGINAL\n');
  assert.equal(await readFile(join(logRoot, 'audit-spool', 'record.json'), 'utf8'), '{}\n');

  await mkdir(join(recordRoot, 'audit-spool'));
  const outsideRecord = join(outside, 'outside-record.json');
  await writeFile(outsideRecord, '{"external":true}\n');
  await symlink(outsideRecord, join(recordRoot, 'audit-spool', 'record.json'));
  assert.equal((await compact(recordRoot, 'linked audit record compaction')).ok, false);
  assert.equal(await readFile(outsideRecord, 'utf8'), '{"external":true}\n');
  assert.equal(await readFile(join(recordRoot, 'audit.log'), 'utf8'), '');

  await mkdir(join(hardRoot, 'audit-spool'));
  const outsideHardRecord = join(outside, 'outside-hard-record.json');
  await writeFile(outsideHardRecord, '{"hard":true}\n');
  await link(outsideHardRecord, join(hardRoot, 'audit-spool', 'record.json'));
  assert.equal((await compact(hardRoot, 'hard-linked audit record compaction')).ok, false);
  assert.equal(await readFile(outsideHardRecord, 'utf8'), '{"hard":true}\n');
  assert.equal(await readFile(join(hardRoot, 'audit.log'), 'utf8'), '');
});

async function normalRotationRoot(t) {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-rotation-ok-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'audit.log'), Buffer.alloc(5_242_881, 'x'));
  return root;
}

for (const [label, command, args] of [
  ['Bash', bashCommand, ['nova-plugin/hooks/scripts/post-audit-log.sh']],
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
    const compacted = await compact(root, `${label} rotation compaction`);
    assert.equal(compacted.ok, true, compacted.stderr);
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
    const compacted = await compact(root, `${label} blocked rotation compaction`);
    assert.equal(compacted.ok, false);
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
    const compacted = await compact(root, `${label} NotebookEdit compaction`);
    assert.equal(compacted.ok, true, compacted.stderr);
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
  const compacted = await compact(root, 'external path compaction');
  assert.equal(compacted.ok, true, compacted.stderr);
  await assert.rejects(() => stat(join(root, 'audit.log')), { code: 'ENOENT' });
});

test('audit compactor removes a newly created lock when owner creation fails', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'nova-audit-owner-failure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const preload = [
    "import fs from 'node:fs'",
    "import { syncBuiltinESMExports } from 'node:module'",
    'const originalOpenSync = fs.openSync',
    "fs.openSync = (path, ...args) => String(path).endsWith('/owner.json') ? (() => { const error = new Error('injected owner failure'); error.code = 'EACCES'; throw error })() : originalOpenSync(path, ...args)",
    'syncBuiltinESMExports()',
  ].join(';');
  const result = await runProcess('audit owner creation failure', process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(preload)}`,
    'nova-plugin/hooks/scripts/audit-compactor.mjs',
  ], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PLUGIN_DATA: root },
  });
  assert.equal(result.ok, false);
  await assert.rejects(() => stat(join(root, '.audit-compact.lock')), { code: 'ENOENT' });
  assert.match(await readFile(join(root, 'audit-health.log'), 'utf8'), /injected owner failure/u);
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
  const identity = spawnSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], { encoding: 'utf8', shell: false });
  if (identity.status !== 0 || !identity.stdout.trim()) {
    t.skip('current platform cannot observe process start identity with ps');
    return;
  }
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
  const compacted = await compact(root, 'external path compaction');
  assert.equal(compacted.ok, true, compacted.stderr);
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
  const compacted = await compact(root, 'outcomes compaction');
  assert.equal(compacted.ok, true, compacted.stderr);
  const records = (await readFile(join(root, 'audit.log'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(records.map((record) => record.outcome), ['failed', 'denied', 'unknown']);
});

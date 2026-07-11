import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const guard = 'nova-plugin/hooks/scripts/pre-write-check.mjs';

async function runGuard(payload, options = {}) {
  return runProcess('pre-write guard test', options.command ?? process.execPath, options.args ?? [guard], {
    cwd: options.cwd ?? root,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: resolve(root, 'nova-plugin'), ...(options.env ?? {}) },
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
}

function writePayload(filePath, content) {
  return { tool_name: 'Write', tool_input: { file_path: filePath, content } };
}

function editPayload(filePath, oldString, newString, replaceAll = false) {
  return {
    tool_name: 'Edit',
    tool_input: { file_path: filePath, old_string: oldString, new_string: newString, replace_all: replaceAll },
  };
}

function notebookEditPayload(notebookPath) {
  return {
    tool_name: 'NotebookEdit',
    tool_input: { notebook_path: notebookPath, cell_id: 'cell-1', new_source: 'print("changed")' },
  };
}

test('write guard fails closed for malformed payloads and secrets', async () => {
  const malformed = await runGuard('{bad json');
  assert.equal(malformed.code, 2);
  assert.match(malformed.stderr, /有效 JSON/);

  const candidateName = ['OPENAI', 'API', 'KEY'].join('_');
  const candidateValue = ['sk', 'proj', 'a'.repeat(24)].join('-');
  const candidateText = [candidateName, candidateValue].join(String.fromCharCode(61));
  const blocked = await runGuard(writePayload('example.env', candidateText));
  assert.equal(blocked.code, 2);
  assert.match(blocked.stderr, /敏感信息/);

  const ordinary = await runGuard(writePayload('README.md', 'ordinary public text'));
  assert.equal(ordinary.ok, true, ordinary.stderr);
});

test('write guard reconstructs Edit content before validating hooks.json', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-pre-write-edit-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const hooksPath = join(temp, 'hooks.json');
  const hooks = await readFile(resolve(root, 'nova-plugin/hooks/hooks.json'), 'utf8');
  await writeFile(hooksPath, hooks);

  const valid = await runGuard(editPayload(hooksPath, '"timeout": 10', '"timeout": 12'));
  assert.equal(valid.ok, true, valid.stderr);

  const invalid = await runGuard(editPayload(hooksPath, '"hooks": {', '"hooks": ['));
  assert.equal(invalid.code, 2);
  assert.match(invalid.stderr, /hooks\.json 结构无效/);
});

test('write guard enforces Edit matching and replace_all semantics', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-pre-write-match-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const target = join(temp, 'file.txt');
  await writeFile(target, 'same\nsame\n');

  const ambiguous = await runGuard(editPayload(target, 'same', 'changed'));
  assert.equal(ambiguous.code, 2);
  assert.match(ambiguous.stderr, /命中不唯一/);

  const replaceAll = await runGuard(editPayload(target, 'same', 'changed', true));
  assert.equal(replaceAll.ok, true, replaceAll.stderr);

  const missing = await runGuard(editPayload(target, 'absent', 'changed'));
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /未在目标文件中命中/);
});

test('write guard rejects missing and symlink Edit targets', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-pre-write-target-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const target = join(temp, 'target.txt');
  const link = join(temp, 'link.txt');
  await writeFile(target, 'old');
  await symlink(target, link);

  const missing = await runGuard(editPayload(join(temp, 'missing.txt'), 'old', 'new'));
  assert.equal(missing.code, 2);
  assert.match(missing.stderr, /不存在/);

  const linked = await runGuard(editPayload(link, 'old', 'new'));
  assert.equal(linked.code, 2);
  assert.match(linked.stderr, /符号链接/);
});

test('write guard rejects unsafe existing Write targets', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-pre-write-target-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const target = join(temp, 'target.txt');
  const link = join(temp, 'link.txt');
  const directory = join(temp, 'directory');
  await writeFile(target, 'old');
  await symlink(target, link);
  await mkdir(directory);

  const linked = await runGuard(writePayload(link, 'new'));
  assert.equal(linked.code, 2);
  assert.match(linked.stderr, /符号链接/);

  const nonFile = await runGuard(writePayload(directory, 'new'));
  assert.equal(nonFile.code, 2);
  assert.match(nonFile.stderr, /普通文件/);

  const regular = await runGuard(writePayload(target, 'new'));
  assert.equal(regular.ok, true, regular.stderr);

  const missing = await runGuard(writePayload(join(temp, 'new.txt'), 'new'));
  assert.equal(missing.ok, true, missing.stderr);
});

test('write guard fails closed for NotebookEdit', async () => {
  const blocked = await runGuard(notebookEditPayload('analysis.ipynb'));
  assert.equal(blocked.code, 2);
  assert.match(blocked.stderr, /无法可靠重构完整 proposed content/);

  const malformed = await runGuard(notebookEditPayload(''));
  assert.equal(malformed.code, 2);
  assert.match(malformed.stderr, /缺少 notebook_path/);
});

test('write guard recognizes Windows hooks.json paths for full Write payloads', async () => {
  const hooks = await readFile(resolve(root, 'nova-plugin/hooks/hooks.json'), 'utf8');
  const result = await runGuard(writePayload('C:\\project\\nova-plugin\\hooks\\hooks.json', hooks));
  assert.equal(result.ok, true, result.stderr);
});

test('Bash launcher fails closed without Node and honors explicit opt-out', async () => {
  const script = resolve(root, 'nova-plugin/hooks/scripts/pre-write-check.sh');
  const env = { PATH: '/usr/bin:/bin', CLAUDE_PLUGIN_ROOT: resolve(root, 'nova-plugin') };
  const payload = writePayload('README.md', 'ordinary text');
  const noNode = await runGuard(payload, { command: '/bin/bash', args: [script], env });
  if (!noNode.ok) {
    assert.equal(noNode.code, 2);
    assert.match(noNode.stderr, /Node\.js 20\+/);
  }

  const disabled = await runGuard(payload, {
    command: '/bin/bash',
    args: [script],
    env: { ...env, NOVA_WRITE_GUARD_DISABLED: '1' },
  });
  assert.equal(disabled.ok, true, disabled.stderr);
  assert.match(disabled.stderr, /explicitly disabled/);
});

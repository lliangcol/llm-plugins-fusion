import assert from 'node:assert/strict';
import { link, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const guard = 'nova-plugin/hooks/scripts/pre-write-check.mjs';

async function runGuard(payload, options = {}) {
  const payloadPath = typeof payload === 'object'
    ? (payload.tool_input?.file_path ?? payload.tool_input?.notebook_path)
    : null;
  const inferredRoot = payloadPath && isAbsolute(payloadPath) ? dirname(payloadPath) : (options.cwd ?? root);
  return runProcess('pre-write guard test', options.command ?? process.execPath, options.args ?? [resolve(root, guard)], {
    cwd: options.cwd ?? root,
    env: {
      ...process.env,
      CLAUDE_PLUGIN_ROOT: resolve(root, 'nova-plugin'),
      CLAUDE_PROJECT_DIR: options.projectRoot ?? inferredRoot,
      ...(options.env ?? {}),
    },
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
  await mkdir(join(temp, '.claude'));
  const hooksPath = join(temp, '.claude/hooks.json');
  const hooks = await readFile(resolve(root, 'nova-plugin/hooks/hooks.json'), 'utf8');
  await writeFile(hooksPath, hooks);

  const valid = await runGuard(editPayload(hooksPath, '检查文件写入规范...', '检查文件写入策略...'), { projectRoot: temp });
  assert.equal(valid.ok, true, valid.stderr);

  const invalid = await runGuard(editPayload(hooksPath, '"hooks": {', '"hooks": ['), { projectRoot: temp });
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

test('write guard detects secrets formed across Edit boundaries', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-pre-write-secret-boundary-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const target = join(temp, 'file.txt');

  await writeFile(target, `token=sk-proj-${'a'.repeat(16)}`);
  const openAi = await runGuard(editPayload(target, 'a'.repeat(16), 'a'.repeat(24)));
  assert.equal(openAi.code, 2);
  assert.match(openAi.stderr, /openai-api-key/);

  await writeFile(target, `token=github_pat_${'b'.repeat(16)}`);
  const github = await runGuard(editPayload(target, 'b'.repeat(16), 'b'.repeat(24)));
  assert.equal(github.code, 2);
  assert.match(github.stderr, /github-token/);
});

test('write guard allows removing or preserving an existing secret without adding one', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-pre-write-existing-secret-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const target = join(temp, 'file.txt');
  const token = `sk-proj-${'a'.repeat(24)}`;

  await writeFile(target, `prefix\n${token}\nsuffix\n`);
  const unrelated = await runGuard(editPayload(target, 'prefix', 'public prefix'));
  assert.equal(unrelated.ok, true, unrelated.stderr);

  const removed = await runGuard(editPayload(target, token, '<redacted>'));
  assert.equal(removed.ok, true, removed.stderr);
});

test('write guard fails closed for oversized and binary Edit targets', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-pre-write-file-boundary-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const binary = join(temp, 'binary.dat');
  const oversized = join(temp, 'oversized.txt');
  await writeFile(binary, Buffer.from([0, 1, 2, 3]));
  await writeFile(oversized, Buffer.alloc(10 * 1024 * 1024 + 1, 'x'));

  const binaryResult = await runGuard(editPayload(binary, '\u0000', 'x'));
  assert.equal(binaryResult.code, 2);
  assert.match(binaryResult.stderr, /二进制/);

  const oversizedResult = await runGuard(editPayload(oversized, 'x', 'y', true));
  assert.equal(oversizedResult.code, 2);
  assert.match(oversizedResult.stderr, /大小上限/);
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
  assert.match(missing.stderr, /does not exist/);

  const linked = await runGuard(editPayload(link, 'old', 'new'));
  assert.equal(linked.code, 2);
  assert.match(linked.stderr, /symlink or junction/);
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
  assert.match(linked.stderr, /symlink or junction/);

  const nonFile = await runGuard(writePayload(directory, 'new'));
  assert.equal(nonFile.code, 2);
  assert.match(nonFile.stderr, /regular file/);

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

test('write guard applies nova schema only to exact protected hooks paths', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-unrelated-hooks-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  await mkdir(join(temp, 'config'));
  const unrelated = join(temp, 'config/hooks.json');
  await writeFile(unrelated, '{"ordinary":true}\n');
  const result = await runGuard(writePayload(unrelated, '{"ordinary":false}\n'), { projectRoot: temp });
  assert.equal(result.ok, true, result.stderr);
});

test('write guard contains targets to workspace or explicit artifact roots', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-containment-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const workspace = join(temp, 'workspace');
  const outside = join(temp, 'outside');
  await Promise.all([mkdir(workspace), mkdir(outside)]);

  const inside = await runGuard(writePayload(join(workspace, 'new.txt'), 'ok'), { projectRoot: workspace });
  assert.equal(inside.ok, true, inside.stderr);
  for (const filePath of ['../outside/escape.txt', join(outside, 'escape.txt')]) {
    const escaped = await runGuard(writePayload(filePath, 'blocked'), { projectRoot: workspace, cwd: workspace });
    assert.equal(escaped.code, 2);
    assert.match(escaped.stderr, /outside explicit allowed roots/);
  }
  const artifact = await runGuard(writePayload(join(outside, 'report.md'), 'allowed'), {
    projectRoot: workspace,
    env: { NOVA_EXPLICIT_ARTIFACT_ROOT: outside },
  });
  assert.equal(artifact.ok, true, artifact.stderr);
});

test('write guard rejects parent symlink escapes and protected hard links', { skip: process.platform === 'win32' }, async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-containment-links-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const workspace = join(temp, 'workspace');
  const outside = join(temp, 'outside');
  await Promise.all([mkdir(workspace), mkdir(outside)]);
  await symlink(outside, join(workspace, 'link'));
  const linkedParent = await runGuard(writePayload(join(workspace, 'link/escape.txt'), 'blocked'), { projectRoot: workspace });
  assert.equal(linkedParent.code, 2);
  assert.match(linkedParent.stderr, /symlink or junction/);

  await mkdir(join(workspace, '.claude'));
  const hooksPath = join(workspace, '.claude/hooks.json');
  const hooks = await readFile(resolve(root, 'nova-plugin/hooks/hooks.json'), 'utf8');
  await writeFile(hooksPath, hooks);
  await link(hooksPath, join(workspace, 'hooks-copy.json'));
  const hardLinked = await runGuard(editPayload(hooksPath, '"timeout": 10', '"timeout": 12'), { projectRoot: workspace });
  assert.equal(hardLinked.code, 2);
  assert.match(hardLinked.stderr, /multiple hard links/);
});

test('write guard rejects oversized Write payloads', async (t) => {
  const temp = await mkdtemp(join(tmpdir(), 'nova-write-size-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const result = await runGuard(writePayload(join(temp, 'large.txt'), 'x'.repeat(10 * 1024 * 1024 + 1)), { projectRoot: temp });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Write 内容超过安全扫描大小上限/);
});

test('Bash launcher fails closed without Node and honors explicit opt-out', async () => {
  const script = resolve(root, 'nova-plugin/hooks/scripts/pre-write-check.sh');
  const env = { PATH: '/usr/bin:/bin', CLAUDE_PLUGIN_ROOT: resolve(root, 'nova-plugin') };
  const noNode = await runGuard(undefined, { command: '/bin/bash', args: [script], env });
  if (!noNode.ok) {
    assert.equal(noNode.code, 2);
    assert.match(noNode.stderr, /Node\.js 22\+/);
  }

  const disabled = await runGuard(undefined, {
    command: '/bin/bash',
    args: [script],
    env: { ...env, NOVA_WRITE_GUARD_DISABLED: '1' },
  });
  assert.equal(disabled.ok, true, disabled.stderr);
  assert.match(disabled.stderr, /explicitly disabled/);
});

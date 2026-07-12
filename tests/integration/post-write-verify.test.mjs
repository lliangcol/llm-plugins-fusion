import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const root = resolve(new URL('../..', import.meta.url).pathname);
const verifier = resolve(root, 'nova-plugin/hooks/scripts/post-write-verify.mjs');

function payload(workspace, filePath, toolName = 'Write') {
  return {
    hook_event_name: 'PostToolUse',
    cwd: workspace,
    tool_name: toolName,
    tool_input: { file_path: filePath },
    tool_response: { success: true, filePath },
  };
}

async function runVerifier(workspace, filePath, options = {}) {
  return runProcess('post-write verifier test', process.execPath, [verifier], {
    cwd: workspace,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: workspace,
      CLAUDE_PLUGIN_ROOT: resolve(root, 'nova-plugin'),
      ...(options.env ?? {}),
    },
    input: JSON.stringify(payload(workspace, filePath, options.toolName)),
  });
}

async function fixture(t) {
  const temp = await mkdtemp(join(tmpdir(), 'nova-post-write-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const workspace = join(temp, 'workspace');
  const outside = join(temp, 'outside');
  await Promise.all([mkdir(workspace), mkdir(outside)]);
  return { temp, workspace, outside };
}

test('post-write verifier accepts a regular in-workspace actual target', async (t) => {
  const { workspace } = await fixture(t);
  const target = join(workspace, 'file.txt');
  await writeFile(target, 'actual');
  const result = await runVerifier(workspace, target);
  assert.equal(result.ok, true, result.stderr);
});

test('post-write verifier detects outside targets and parent replacement links', { skip: process.platform === 'win32' }, async (t) => {
  const { workspace, outside } = await fixture(t);
  const outsideFile = join(outside, 'file.txt');
  await writeFile(outsideFile, 'outside');
  const escaped = await runVerifier(workspace, outsideFile);
  assert.equal(escaped.code, 2);
  assert.match(escaped.stderr, /workspace containment/);

  await symlink(outside, join(workspace, 'replaced-parent'));
  const linked = await runVerifier(workspace, join(workspace, 'replaced-parent/file.txt'));
  assert.equal(linked.code, 2);
  assert.match(linked.stderr, /symlink or junction/);
});

test('post-write verifier revalidates only exact protected hooks configuration', async (t) => {
  const { workspace } = await fixture(t);
  await Promise.all([mkdir(join(workspace, '.claude')), mkdir(join(workspace, 'config'))]);
  const protectedPath = join(workspace, '.claude/hooks.json');
  await writeFile(protectedPath, '{"hooks":[]}\n');
  const blocked = await runVerifier(workspace, protectedPath);
  assert.equal(blocked.code, 2);
  assert.match(blocked.stderr, /Protected hooks configuration is invalid/);

  const unrelatedPath = join(workspace, 'config/hooks.json');
  await writeFile(unrelatedPath, '{"ordinary":true}\n');
  const allowed = await runVerifier(workspace, unrelatedPath);
  assert.equal(allowed.ok, true, allowed.stderr);
});

import assert from 'node:assert/strict';
import { link, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join, win32 } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  configuredArtifactRoots,
  isPathInside,
  isProtectedHooksPath,
  resolveWorkspaceTarget,
} from '../../nova-plugin/runtime/safe-workspace-path.mjs';

async function workspaceFixture(t) {
  const temp = await mkdtemp(join(tmpdir(), 'nova-safe-path-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const workspace = join(temp, 'workspace');
  const outside = join(temp, 'outside');
  const artifacts = join(temp, 'artifacts');
  await Promise.all([mkdir(workspace), mkdir(outside), mkdir(artifacts)]);
  return { temp, workspace, outside, artifacts };
}

test('workspace policy allows regular existing and new in-root files', async (t) => {
  const { workspace } = await workspaceFixture(t);
  const existing = join(workspace, 'file.txt');
  await writeFile(existing, 'ok');
  assert.equal(resolveWorkspaceTarget({ filePath: existing, projectRoot: workspace, mustExist: true }).exists, true);
  assert.equal(resolveWorkspaceTarget({ filePath: 'new/file.txt', projectRoot: workspace }).exists, false);
});

test('workspace policy rejects lexical and absolute escapes', async (t) => {
  const { workspace, outside } = await workspaceFixture(t);
  await writeFile(join(outside, 'file.txt'), 'outside');
  assert.throws(() => resolveWorkspaceTarget({ filePath: '../outside/file.txt', projectRoot: workspace }), /outside explicit allowed roots/);
  assert.throws(() => resolveWorkspaceTarget({ filePath: join(outside, 'file.txt'), projectRoot: workspace }), /outside explicit allowed roots/);
});

test('workspace policy rejects parent symlinks and protected hard links', { skip: process.platform === 'win32' }, async (t) => {
  const { workspace, outside } = await workspaceFixture(t);
  await symlink(outside, join(workspace, 'link'));
  assert.throws(() => resolveWorkspaceTarget({ filePath: 'link/new.txt', projectRoot: workspace }), /symlink or junction/);

  await mkdir(join(workspace, '.claude'));
  const hooks = join(workspace, '.claude/hooks.json');
  await writeFile(hooks, '{}');
  await link(hooks, join(workspace, 'hooks-copy.json'));
  assert.throws(() => resolveWorkspaceTarget({
    filePath: hooks, projectRoot: workspace, mustExist: true, protectedTarget: true,
  }), /multiple hard links/);
});

test('explicit artifact roots are opt-in and parsed without broadening project scope', async (t) => {
  const { workspace, artifacts } = await workspaceFixture(t);
  const target = join(artifacts, 'report.md');
  assert.throws(() => resolveWorkspaceTarget({ filePath: target, projectRoot: workspace }), /outside explicit allowed roots/);
  assert.equal(resolveWorkspaceTarget({ filePath: target, projectRoot: workspace, artifactRoots: [artifacts] }).allowedRoot, artifacts);
  assert.deepEqual(configuredArtifactRoots({ NOVA_EXPLICIT_ARTIFACT_ROOTS: JSON.stringify([artifacts]) }), [artifacts]);
});

test('path comparisons handle Windows drive case and sibling prefixes', () => {
  assert.equal(isPathInside('C:\\Work', 'c:\\work\\src\\file.ts', { platform: 'win32', pathApi: win32 }), true);
  assert.equal(isPathInside('C:\\Work', 'C:\\Work-other\\file.ts', { platform: 'win32', pathApi: win32 }), false);
});

test('protected hook paths are exact rather than basename-wide', async (t) => {
  const { workspace } = await workspaceFixture(t);
  const pluginRoot = join(workspace, 'nova-plugin');
  assert.equal(isProtectedHooksPath(join(workspace, '.claude/hooks.json'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedHooksPath(join(workspace, 'config/hooks.json'), { projectRoot: workspace, pluginRoot }), false);
});

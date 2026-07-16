import assert from 'node:assert/strict';
import { chmod, link, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { delimiter, join, resolve, win32 } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import test from 'node:test';
import {
  assertArtifactRootsOutsideExecutableSearch,
  configuredArtifactRoots,
  isPathInside,
  isProtectedHooksPath,
  isProtectedShellControlPath,
  protectedShellControlPaths,
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

test('workspace policy rejects parent symlinks and every existing hard-linked target', { skip: process.platform === 'win32' }, async (t) => {
  const { workspace, outside } = await workspaceFixture(t);
  await symlink(outside, join(workspace, 'link'));
  assert.throws(() => resolveWorkspaceTarget({ filePath: 'link/new.txt', projectRoot: workspace }), /symlink or junction/);

  await mkdir(join(workspace, '.claude'));
  const hooks = join(workspace, '.claude/hooks.json');
  await writeFile(hooks, '{}');
  await link(hooks, join(workspace, 'hooks-copy.json'));
  assert.throws(() => resolveWorkspaceTarget({ filePath: hooks, projectRoot: workspace, mustExist: true }), /exactly one hard link/);

  const ordinary = join(workspace, 'ordinary.txt');
  await writeFile(ordinary, 'ordinary');
  await link(ordinary, join(outside, 'ordinary-outside.txt'));
  assert.throws(() => resolveWorkspaceTarget({ filePath: ordinary, projectRoot: workspace, mustExist: true }), /exactly one hard link/);
});

test('explicit artifact roots are opt-in and parsed without broadening project scope', async (t) => {
  const { workspace, artifacts } = await workspaceFixture(t);
  const target = join(artifacts, 'report.md');
  assert.throws(() => resolveWorkspaceTarget({ filePath: target, projectRoot: workspace }), /outside explicit allowed roots/);
  assert.equal(resolveWorkspaceTarget({ filePath: target, projectRoot: workspace, artifactRoots: [artifacts] }).allowedRoot, artifacts);
  assert.deepEqual(configuredArtifactRoots({ NOVA_EXPLICIT_ARTIFACT_ROOTS: JSON.stringify([artifacts]) }), [artifacts]);
});

test('artifact-root parsing and required targets fail closed on malformed input', async (t) => {
  const { workspace, outside } = await workspaceFixture(t);
  const missing = join(workspace, 'missing.txt');
  const regularFileRoot = join(outside, 'not-a-directory.txt');
  await writeFile(regularFileRoot, 'ordinary file');

  assert.deepEqual(configuredArtifactRoots({}), []);
  assert.deepEqual(configuredArtifactRoots({ NOVA_EXPLICIT_ARTIFACT_ROOT: workspace }), [workspace]);
  assert.throws(
    () => configuredArtifactRoots({ NOVA_EXPLICIT_ARTIFACT_ROOTS: '[invalid' }),
    /must be a JSON array or path-delimited list/,
  );
  assert.throws(
    () => configuredArtifactRoots({ NOVA_EXPLICIT_ARTIFACT_ROOTS: '[""]' }),
    /must contain non-empty path strings/,
  );
  assert.throws(
    () => resolveWorkspaceTarget({ filePath: missing, projectRoot: workspace, mustExist: true }),
    /target does not exist/,
  );
  assert.throws(
    () => resolveWorkspaceTarget({ filePath: 'file.txt', projectRoot: join(outside, 'absent') }),
    /project root does not exist/,
  );
  assert.throws(
    () => resolveWorkspaceTarget({ filePath: 'file.txt', projectRoot: regularFileRoot }),
    /must be a real directory/,
  );
});

test('artifact roots cannot overlap executable search, broad project ancestors, or control directories', { skip: process.platform === 'win32' }, async (t) => {
  const { temp, workspace, artifacts } = await workspaceFixture(t);
  const trustedBin = join(temp, 'trusted-bin');
  await mkdir(trustedBin);
  assert.throws(
    () => assertArtifactRootsOutsideExecutableSearch({ artifactRoots: [artifacts], projectRoot: workspace, env: { PATH: artifacts } }),
    /contains executable PATH entry/u,
  );
  assert.deepEqual(
    assertArtifactRootsOutsideExecutableSearch({ artifactRoots: [artifacts], projectRoot: workspace, env: { PATH: trustedBin } }),
    [artifacts],
  );
  assert.deepEqual(
    assertArtifactRootsOutsideExecutableSearch({
      artifactRoots: [artifacts],
      projectRoot: workspace,
      env: { PATH: trustedBin, PATHEXT: '.EXE;.CMD' },
      executableNames: ['git'],
      platform: 'win32',
    }),
    [artifacts],
  );
  assert.throws(
    () => assertArtifactRootsOutsideExecutableSearch({ artifactRoots: [temp], projectRoot: workspace, env: { PATH: trustedBin } }),
    /must not broaden above the project root/u,
  );
  const hiddenControl = join(temp, '.claude');
  await mkdir(hiddenControl);
  assert.throws(
    () => assertArtifactRootsOutsideExecutableSearch({ artifactRoots: [hiddenControl], projectRoot: workspace, env: { PATH: trustedBin } }),
    /security-sensitive control directory/u,
  );
  const hiddenHomeRoot = await mkdtemp(join(homedir(), '.nova-artifact-root-'));
  t.after(() => rm(hiddenHomeRoot, { recursive: true, force: true }));
  assert.throws(
    () => assertArtifactRootsOutsideExecutableSearch({ artifactRoots: [hiddenHomeRoot], projectRoot: workspace, env: { PATH: trustedBin } }),
    /hidden user control directory/u,
  );

  const controlledGit = join(artifacts, 'controlled-git');
  await writeFile(controlledGit, '#!/bin/sh\nexit 0\n');
  await chmod(controlledGit, 0o755);
  await symlink(controlledGit, join(trustedBin, 'git'));
  assert.throws(
    () => assertArtifactRootsOutsideExecutableSearch({ artifactRoots: [artifacts], projectRoot: workspace, env: { PATH: `${trustedBin}${delimiter}` }, executableNames: ['git'] }),
    /controls guarded executable/u,
  );
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
  assert.equal(isProtectedShellControlPath(join(workspace, '.nova/shell-policy.json'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(pluginRoot, 'hooks/scripts/pre-bash-check.mjs'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(workspace, '.git'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(workspace, '.git/config'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(workspace, 'nested/.git/hooks/pre-commit'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(workspace, '.GIT/config'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(workspace, 'nested/.GiT/hooks/pre-commit'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(workspace, '.NOVA/shell-policy.json'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedHooksPath(join(workspace, '.CLAUDE/hooks.json'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(workspace, '.CLAUDE/settings.json'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(workspace, '.claude/SETTINGS.LOCAL.JSON'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(workspace, 'bin/bash'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(workspace, 'tools/BASH.EXE'), { projectRoot: workspace, pluginRoot }), true);
  const externalArtifacts = join(workspace, '..', 'external-artifacts');
  assert.equal(isProtectedShellControlPath(join(externalArtifacts, '.claude/settings.json'), { projectRoot: workspace, pluginRoot, artifactRoots: [externalArtifacts] }), true);
  assert.equal(isProtectedShellControlPath(join(externalArtifacts, '.codex/config.toml'), { projectRoot: workspace, pluginRoot, artifactRoots: [externalArtifacts] }), true);
  assert.equal(isProtectedShellControlPath(join(pluginRoot, 'RUNTIME/bash-common.sh'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(pluginRoot, 'HOOKS/scripts/trusted-node-hook.sh'), { projectRoot: workspace, pluginRoot }), true);
  assert.equal(isProtectedShellControlPath(join(pluginRoot, 'hooks/hooks.json'), { projectRoot: workspace, pluginRoot }), false);
  assert.equal(isProtectedShellControlPath(join(workspace, 'nested/.github/config'), { projectRoot: workspace, pluginRoot }), false);
});

test('protected shell control inventory owns project settings and the plugin runtime closure', async (t) => {
  const { workspace } = await workspaceFixture(t);
  const pluginRoot = join(workspace, 'nova-plugin');
  assert.deepEqual(protectedShellControlPaths({ projectRoot: workspace, pluginRoot }), [
    resolve(workspace, '.nova/shell-policy.json'),
    resolve(workspace, '.claude/settings.json'),
    resolve(workspace, '.claude/settings.local.json'),
    resolve(pluginRoot, 'runtime'),
    resolve(pluginRoot, 'hooks/scripts'),
  ].map((entry) => entry.toLowerCase()));
});

test('every active hook reference and distributed hook/runtime implementation is in the protected trust closure', async () => {
  const projectRoot = join(import.meta.dirname, '../..');
  const pluginRoot = join(projectRoot, 'nova-plugin');
  const hooks = JSON.parse(await readFile(join(pluginRoot, 'hooks/hooks.json'), 'utf8'));
  for (const entries of Object.values(hooks.hooks)) {
    for (const entry of entries) {
      for (const hook of entry.hooks) {
        const reference = hook.args?.find((arg) => arg.includes('${CLAUDE_PLUGIN_ROOT}/'));
        assert.ok(reference, `${entry.matcher} hook must reference a plugin-owned launcher`);
        const target = join(pluginRoot, reference.replace('${CLAUDE_PLUGIN_ROOT}/', ''));
        assert.equal(
          isProtectedShellControlPath(target, { projectRoot, pluginRoot })
            || isProtectedHooksPath(target, { projectRoot, pluginRoot }),
          true,
          `${target} is outside the protected hook trust closure`,
        );
      }
    }
  }

  async function implementationFiles(directory) {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await implementationFiles(target));
      else if (entry.isFile()) files.push(target);
    }
    return files;
  }
  for (const directory of [join(pluginRoot, 'hooks/scripts'), join(pluginRoot, 'runtime')]) {
    for (const target of await implementationFiles(directory)) {
      assert.equal(
        isProtectedShellControlPath(target, { projectRoot, pluginRoot }),
        true,
        `${target} is outside the protected hook trust closure`,
      );
    }
  }
});

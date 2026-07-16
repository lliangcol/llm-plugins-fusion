import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const root = resolve(import.meta.dirname, '../..');
const pluginRoot = resolve(root, 'nova-plugin');
const launcher = resolve(pluginRoot, 'hooks/scripts/trusted-node-hook.sh');

function cleanEnvironment(overrides = {}) {
  const env = { ...process.env };
  for (const variable of Object.keys(env)) {
    if (['BASH_ENV', 'ENV', 'NODE_OPTIONS'].includes(variable) || variable.startsWith('BASH_FUNC_')) delete env[variable];
  }
  return { ...env, ...overrides };
}

async function fixture(t) {
  const workspace = await mkdtemp(join(tmpdir(), 'nova-trusted-node-hook-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await Promise.all([
    mkdir(join(workspace, 'bin')),
    mkdir(join(workspace, 'packages/nested'), { recursive: true }),
    mkdir(join(workspace, 'audit-data')),
  ]);
  return { workspace, cwd: join(workspace, 'packages/nested') };
}

async function runLauncher(label, hookId, { cwd, workspace, env = {}, input = '' }) {
  return runProcess(label, 'bash', ['-p', launcher, hookId], {
    cwd,
    env: cleanEnvironment({
      CLAUDE_PLUGIN_ROOT: pluginRoot,
      CLAUDE_PROJECT_DIR: workspace,
      CLAUDE_PLUGIN_DATA: join(workspace, 'audit-data'),
      ...env,
    }),
    input,
  });
}

test('trusted Node launcher runs each active post-hook target', async (t) => {
  const { workspace, cwd } = await fixture(t);
  const target = join(workspace, 'actual.txt');
  await writeFile(target, 'actual');

  const postWrite = await runLauncher('trusted post-write hook', 'post-write-verify', {
    cwd,
    workspace,
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      cwd,
      tool_name: 'Write',
      tool_input: { file_path: target },
      tool_response: { success: true, filePath: target },
    }),
  });
  assert.equal(postWrite.ok, true, postWrite.stderr);

  const postAudit = await runLauncher('trusted post-audit hook', 'post-audit-log', {
    cwd,
    workspace,
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      cwd,
      tool_name: 'Write',
      tool_input: { file_path: target },
      tool_response: { success: true, filePath: target },
    }),
  });
  assert.equal(postAudit.ok, true, postAudit.stderr);

  const compactor = await runLauncher('trusted session compactor hook', 'audit-compactor', { cwd, workspace });
  assert.equal(compactor.ok, true, compactor.stderr);

  const configChange = await runLauncher('trusted config-change hook', 'config-change-guard', {
    cwd,
    workspace,
    input: JSON.stringify({
      hook_event_name: 'ConfigChange',
      source: 'project_settings',
      file_path: join(workspace, '.claude/settings.json'),
    }),
  });
  assert.equal(configChange.code, 2, configChange.stderr);
  assert.match(configChange.stderr, /changes are frozen for the active session/u);
});

test('trusted Node launcher rejects NODE_OPTIONS before preload and inherited shell startup controls', async (t) => {
  const { workspace, cwd } = await fixture(t);
  const marker = join(workspace, 'startup-control-executed');
  const preload = join(workspace, 'hostile-preload.cjs');
  const startup = join(workspace, 'hostile-startup.sh');
  await writeFile(preload, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'node preload')\n`);
  await writeFile(startup, `printf startup > ${JSON.stringify(marker)}\n`);

  for (const [variable, value, expected] of [
    ['NODE_OPTIONS', `--require=${preload}`, /NODE_OPTIONS inheritance is not allowed/u],
    ['BASH_ENV', startup, /BASH_ENV\/ENV inheritance is not allowed/u],
    ['ENV', startup, /BASH_ENV\/ENV inheritance is not allowed/u],
  ]) {
    const result = await runLauncher(`trusted launcher rejects ${variable}`, 'post-audit-log', {
      cwd,
      workspace,
      env: { [variable]: value },
    });
    assert.equal(result.code, 2, variable);
    assert.match(result.stderr, expected);
    await assert.rejects(readFile(marker, 'utf8'), { code: 'ENOENT' });
  }
});

test('trusted Node launcher rejects exported functions and unknown hook ids', async (t) => {
  const { workspace, cwd } = await fixture(t);
  const functionOverride = await runLauncher('trusted launcher rejects exported function', 'post-audit-log', {
    cwd,
    workspace,
    env: { 'BASH_FUNC_node%%': '() { printf shadow; }' },
  });
  assert.equal(functionOverride.code, 2);
  assert.match(functionOverride.stderr, /Exported Bash functions are not allowed/u);

  const unknown = await runLauncher('trusted launcher rejects unknown target', 'arbitrary-script', { cwd, workspace });
  assert.equal(unknown.code, 2);
  assert.match(unknown.stderr, /Unknown guarded Node hook id/u);
});

test('trusted Node launcher rejects project Node shadows from absolute, relative, and empty PATH entries', async (t) => {
  const { workspace, cwd } = await fixture(t);
  const marker = join(workspace, 'project-node-executed');
  const shadow = `#!/bin/sh\nprintf shadow > ${JSON.stringify(marker)}\nprintf 'v22.0.0\\n'\n`;
  for (const path of [join(workspace, 'bin/node'), join(cwd, 'node')]) {
    await writeFile(path, shadow);
    await chmod(path, 0o755);
  }

  for (const [label, path] of [
    ['absolute project PATH entry', `${join(workspace, 'bin')}${delimiter}${process.env.PATH ?? ''}`],
    ['relative project PATH entry', `../../bin${delimiter}${process.env.PATH ?? ''}`],
    ['empty current-directory PATH entry', `${delimiter}${process.env.PATH ?? ''}`],
  ]) {
    const result = await runLauncher(label, 'post-audit-log', { cwd, workspace, env: { PATH: path } });
    assert.equal(result.code, 2, label);
    assert.match(result.stderr, /trusted Node\.js 22\+ executable outside the project/u);
    await assert.rejects(readFile(marker, 'utf8'), { code: 'ENOENT' });
  }
});

test('trusted Node launcher does not execute PATH-shadowed bootstrap helpers', { skip: process.platform === 'win32' }, async (t) => {
  const { workspace, cwd } = await fixture(t);
  const bin = join(workspace, 'bin');
  const markers = [];
  for (const helper of ['dirname', 'tr', 'cygpath']) {
    const marker = join(workspace, `${helper}-executed`);
    markers.push(marker);
    await writeFile(join(bin, helper), `#!/bin/sh\nprintf shadow > ${JSON.stringify(marker)}\nexit 99\n`);
    await chmod(join(bin, helper), 0o755);
  }
  const result = await runProcess('trusted launcher avoids PATH bootstrap helpers', '/bin/bash', ['-p', launcher, 'post-audit-log'], {
    cwd,
    env: cleanEnvironment({
      PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
      CLAUDE_PROJECT_DIR: workspace,
      CLAUDE_PLUGIN_DATA: join(workspace, 'audit-data'),
    }),
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      cwd,
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
      tool_response: { success: true },
    }),
  });
  assert.equal(result.ok, true, result.stderr);
  for (const marker of markers) await assert.rejects(readFile(marker, 'utf8'), { code: 'ENOENT' });
});

test('trusted Node launcher derives and exports its physical plugin root', async (t) => {
  const { workspace, cwd } = await fixture(t);
  const fakePluginRoot = join(workspace, 'fake-plugin');
  const marker = join(workspace, 'fake-plugin-root-sourced');
  await mkdir(join(fakePluginRoot, 'runtime'), { recursive: true });
  await writeFile(join(fakePluginRoot, 'runtime/bash-common.sh'), `printf fake > ${JSON.stringify(marker)}\n`);
  const result = await runLauncher('trusted launcher ignores injected plugin root', 'post-audit-log', {
    cwd,
    workspace,
    env: { CLAUDE_PLUGIN_ROOT: fakePluginRoot },
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      cwd,
      tool_name: 'Bash',
      tool_input: { command: 'git status' },
      tool_response: { success: true },
    }),
  });
  assert.equal(result.ok, true, result.stderr);
  await assert.rejects(readFile(marker, 'utf8'), { code: 'ENOENT' });
});

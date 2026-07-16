import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const root = resolve(import.meta.dirname, '../..');
const guard = resolve(root, 'nova-plugin/hooks/scripts/pre-bash-check.mjs');
const launcher = resolve(root, 'nova-plugin/hooks/scripts/pre-bash-check.sh');
const writeLauncher = resolve(root, 'nova-plugin/hooks/scripts/pre-write-check.sh');

function policy(entries) {
  return `${JSON.stringify({ schemaVersion: 1, allowCommands: entries })}\n`;
}

function guardEnvironment(overrides = {}) {
  const env = { ...process.env };
  for (const variable of Object.keys(env)) {
    if (['PAGER', 'RIPGREP_CONFIG_PATH'].includes(variable)
      || variable.toUpperCase().startsWith('GIT_')) delete env[variable];
  }
  return { ...env, ...overrides };
}

async function runHook({ command, cwd, projectRoot, sessionId, env = {} }) {
  const isolatedTemp = join(projectRoot, '.tmp');
  return runProcess('pre-bash stdin hook test', process.execPath, [guard], {
    cwd,
    env: guardEnvironment({
      CLAUDE_PLUGIN_ROOT: resolve(root, 'nova-plugin'),
      CLAUDE_PROJECT_DIR: projectRoot,
      TMPDIR: isolatedTemp,
      TMP: isolatedTemp,
      TEMP: isolatedTemp,
      ...env,
    }),
    input: JSON.stringify({
      session_id: sessionId,
      cwd,
      tool_name: 'Bash',
      tool_input: { command },
    }),
  });
}

async function createWorkspace(prefix) {
  const workspace = await mkdtemp(join(tmpdir(), prefix));
  await Promise.all([
    mkdir(join(workspace, '.nova')),
    mkdir(join(workspace, '.tmp')),
    mkdir(join(workspace, 'packages', 'nested'), { recursive: true }),
  ]);
  return workspace;
}

test('Bash stdin hook loads the project policy when the effective cwd is nested', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-root-policy-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  await writeFile(join(workspace, '.nova', 'shell-policy.json'), policy([
    { id: 'project-check', argv: ['npm', 'run', 'project-check'], purpose: 'Project-owned exact validation command.' },
  ]));

  const result = await runHook({ command: 'npm run project-check', cwd, projectRoot: workspace, sessionId: 'nested-policy' });
  assert.equal(result.ok, true, result.stderr);
});

test('Bash stdin hook rejects PATH shadows anywhere under the project root', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-shadow-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  const bin = join(workspace, 'bin');
  await mkdir(bin);
  const shadow = join(bin, process.platform === 'win32' ? 'git.cmd' : 'git');
  await writeFile(shadow, process.platform === 'win32' ? '@echo off\r\nexit /b 0\r\n' : '#!/bin/sh\nexit 0\n');
  if (process.platform !== 'win32') await chmod(shadow, 0o755);

  const result = await runHook({
    command: 'git status',
    cwd,
    projectRoot: workspace,
    sessionId: 'nested-shadow',
    env: { PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` },
  });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /executable resolves inside the workspace/u);
});

test('Bash stdin hook follows executable PATH search past non-executable candidates', { skip: process.platform === 'win32' }, async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-executable-shadow-');
  const externalBin = await mkdtemp(join(tmpdir(), 'nova-pre-bash-non-executable-bin-'));
  t.after(() => Promise.all([
    rm(workspace, { recursive: true, force: true }),
    rm(externalBin, { recursive: true, force: true }),
  ]));
  const cwd = join(workspace, 'packages', 'nested');
  const workspaceBin = join(workspace, 'bin');
  await mkdir(workspaceBin);
  const placeholder = join(externalBin, 'git');
  const shadow = join(workspaceBin, 'git');
  await writeFile(placeholder, '#!/bin/sh\nexit 0\n');
  await chmod(placeholder, 0o644);
  await writeFile(shadow, '#!/bin/sh\nexit 0\n');
  await chmod(shadow, 0o755);

  const result = await runHook({
    command: 'git status',
    cwd,
    projectRoot: workspace,
    sessionId: 'executable-shadow',
    env: { PATH: `${externalBin}${delimiter}${workspaceBin}` },
  });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /executable resolves inside the workspace/u);
});

test('Bash stdin hook rejects an exported function override', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-function-override-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  const result = await runHook({
    command: 'git status',
    cwd,
    projectRoot: workspace,
    sessionId: 'function-override',
    env: { 'BASH_FUNC_git%%': '() { echo shadow; }' },
  });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /exported Bash function overrides executable resolution: git/u);
});

test('Bash stdin hook defensively rejects inherited shell startup files', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-startup-file-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  for (const variable of ['BASH_ENV', 'ENV']) {
    const result = await runHook({
      command: 'git status',
      cwd,
      projectRoot: workspace,
      sessionId: `startup-${variable.toLowerCase()}`,
      env: { [variable]: join(workspace, 'hostile-startup.sh') },
    });
    assert.equal(result.code, 2, variable);
    assert.match(result.stderr, new RegExp(`${variable} is not allowed for guarded Bash execution`, 'u'));
  }
});

test('Bash stdin hook rejects executable-specific environment injection', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-environment-injection-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  const cases = [
    ['git status', 'GIT_EXTERNAL_DIFF', 'hostile-value'],
    ['git status', 'GIT_CONFIG_COUNT', 'hostile-value'],
    ['git status', 'GIT_CONFIG_KEY_19', 'hostile-value'],
    ['git status', 'GIT_CONFIG_VALUE_19', 'hostile-value'],
    ['git status', 'GIT_CONFIG_SYSTEM', 'hostile-value'],
    ['git status', 'GIT_CONFIG_GLOBAL', 'hostile-value'],
    ['git status', 'GIT_CONFIG_PARAMETERS', "'diff.external'='/usr/bin/false'"],
    ['git status', 'GIT_DIR', '/tmp/not-a-repo'],
    ['git status', 'GIT_WORK_TREE', '/tmp'],
    ['git status', 'GIT_EXEC_PATH', '/tmp'],
    ['git status', 'GIT_TRACE', '/tmp/nova-git-trace'],
    ['git status', 'GIT_PAGER', '/usr/bin/false'],
    ['git status', 'PAGER', '/usr/bin/false'],
    ['rg pattern .', 'RIPGREP_CONFIG_PATH', 'hostile-value'],
  ];
  for (const [command, variable, value] of cases) {
    const result = await runHook({
      command,
      cwd,
      projectRoot: workspace,
      sessionId: `environment-${variable.toLowerCase()}`,
      env: { [variable]: value },
    });
    assert.equal(result.code, 2, variable);
    assert.match(result.stderr, new RegExp(`${variable} is not allowed for guarded`, 'u'));
  }
});

test('Bash stdin hook accepts only a safely resolved literal cat Git pager', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-pager-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  const inherited = await runHook({
    command: 'git status',
    cwd,
    projectRoot: workspace,
    sessionId: 'pager-literal-cat',
    env: { GIT_PAGER: 'cat', PAGER: 'cat' },
  });
  assert.equal(inherited.ok, true, inherited.stderr);

  const bin = join(workspace, 'bin');
  await mkdir(bin);
  const shadow = join(bin, process.platform === 'win32' ? 'cat.cmd' : 'cat');
  await writeFile(shadow, process.platform === 'win32' ? '@echo off\r\nexit /b 0\r\n' : '#!/bin/sh\nexit 0\n');
  if (process.platform !== 'win32') await chmod(shadow, 0o755);
  const shadowed = await runHook({
    command: 'git status',
    cwd,
    projectRoot: workspace,
    sessionId: 'pager-shadow',
    env: {
      PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
      GIT_PAGER: 'cat',
      PAGER: 'cat',
    },
  });
  assert.equal(shadowed.code, 2);
  assert.match(shadowed.stderr, /trusted Git pager cat.*inside the workspace/u);

  const functionOverride = await runHook({
    command: 'git status',
    cwd,
    projectRoot: workspace,
    sessionId: 'pager-function',
    env: {
      GIT_PAGER: 'cat',
      PAGER: 'cat',
      'BASH_FUNC_cat%%': '() { echo shadow; }',
    },
  });
  assert.equal(functionOverride.code, 2);
  assert.match(functionOverride.stderr, /exported Bash function overrides the trusted Git pager/u);
});

test('privileged-mode Bash launcher rejects startup-file variables before they can be sourced', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-launcher-startup-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  for (const variable of ['BASH_ENV', 'ENV']) {
    const startup = join(workspace, `hostile-${variable.toLowerCase()}.sh`);
    const marker = join(workspace, `${variable.toLowerCase()}-sourced`);
    await writeFile(startup, `printf sourced > ${JSON.stringify(marker)}\n`);
    const result = await runProcess('pre-bash privileged launcher test', 'bash', ['-p', launcher], {
      cwd,
      env: {
        ...process.env,
        [variable]: startup,
        CLAUDE_PLUGIN_ROOT: resolve(root, 'nova-plugin'),
        CLAUDE_PROJECT_DIR: workspace,
      },
      input: JSON.stringify({
        session_id: `launcher-${variable.toLowerCase()}`,
        cwd,
        tool_name: 'Bash',
        tool_input: { command: 'git status' },
      }),
    });
    assert.equal(result.code, 2, variable);
    assert.match(result.stderr, /BASH_ENV\/ENV inheritance is not allowed for guarded shell launchers/u);
    await assert.rejects(readFile(marker, 'utf8'), { code: 'ENOENT' });
  }
});

test('privileged-mode launchers reject NODE_OPTIONS before any Node preload', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-launcher-node-options-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  const preload = join(workspace, 'hostile-preload.cjs');
  const marker = join(workspace, 'node-options-preloaded');
  await writeFile(preload, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'preloaded')\n`);

  const launchers = [
    {
      label: 'Bash broker',
      path: launcher,
      payload: {
        session_id: 'launcher-node-options-bash',
        cwd,
        tool_name: 'Bash',
        tool_input: { command: 'git status' },
      },
    },
    {
      label: 'write guard',
      path: writeLauncher,
      payload: {
        session_id: 'launcher-node-options-write',
        cwd,
        tool_name: 'Write',
        tool_input: { file_path: join(workspace, 'safe.txt'), content: 'safe' },
      },
    },
  ];

  for (const entry of launchers) {
    const result = await runProcess(`preload-safe ${entry.label} launcher test`, 'bash', ['-p', entry.path], {
      cwd,
      env: {
        ...process.env,
        NODE_OPTIONS: `--require=${preload}`,
        CLAUDE_PLUGIN_ROOT: resolve(root, 'nova-plugin'),
        CLAUDE_PROJECT_DIR: workspace,
      },
      input: JSON.stringify(entry.payload),
    });
    assert.equal(result.code, 2, entry.label);
    assert.match(result.stderr, /NODE_OPTIONS inheritance is not allowed before guarded Node startup/u);
    await assert.rejects(readFile(marker, 'utf8'), { code: 'ENOENT' });
  }
});

test('privileged-mode launchers reject project Node PATH shadows before execution', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-launcher-node-shadow-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  const bin = join(workspace, 'bin');
  const marker = join(workspace, 'project-node-executed');
  await mkdir(bin);
  const shadowScript = `#!/bin/sh\nprintf shadow > ${JSON.stringify(marker)}\nprintf 'v22.0.0\\n'\n`;
  for (const path of [join(bin, 'node'), join(cwd, 'node')]) {
    await writeFile(path, shadowScript);
    await chmod(path, 0o755);
  }

  const launchers = [
    {
      label: 'Bash broker',
      path: launcher,
      payload: {
        session_id: 'launcher-node-shadow-bash',
        cwd,
        tool_name: 'Bash',
        tool_input: { command: 'git status' },
      },
    },
    {
      label: 'write guard',
      path: writeLauncher,
      payload: {
        session_id: 'launcher-node-shadow-write',
        cwd,
        tool_name: 'Write',
        tool_input: { file_path: join(workspace, 'safe.txt'), content: 'safe' },
      },
    },
  ];
  const pathCases = [
    ['absolute project entry', `${bin}${delimiter}${process.env.PATH ?? ''}`],
    ['relative project entry', `../../bin${delimiter}${process.env.PATH ?? ''}`],
    ['empty current-directory entry', `${delimiter}${process.env.PATH ?? ''}`],
  ];

  for (const entry of launchers) {
    for (const [pathLabel, path] of pathCases) {
      const result = await runProcess(`shadow-safe ${entry.label} ${pathLabel} launcher test`, 'bash', ['-p', entry.path], {
        cwd,
        env: {
          ...process.env,
          PATH: path,
          CLAUDE_PLUGIN_ROOT: resolve(root, 'nova-plugin'),
          CLAUDE_PROJECT_DIR: workspace,
        },
        input: JSON.stringify(entry.payload),
      });
      assert.equal(result.code, 2, `${entry.label}: ${pathLabel}`);
      assert.match(result.stderr, /trusted Node\.js 22\+ executable outside the project/u);
      await assert.rejects(readFile(marker, 'utf8'), { code: 'ENOENT' });
    }
  }
});

test('privileged-mode pre-use launchers do not execute PATH-shadowed bootstrap helpers', { skip: process.platform === 'win32' }, async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-launcher-helper-shadow-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  const bin = join(workspace, 'bin');
  await mkdir(bin);
  const markers = [];
  for (const helper of ['dirname', 'tr', 'cygpath']) {
    const marker = join(workspace, `${helper}-executed`);
    markers.push(marker);
    await writeFile(join(bin, helper), `#!/bin/sh\nprintf shadow > ${JSON.stringify(marker)}\nexit 99\n`);
    await chmod(join(bin, helper), 0o755);
  }
  const entries = [
    {
      label: 'Bash broker',
      path: launcher,
      payload: { session_id: 'helper-shadow-bash', cwd, tool_name: 'Bash', tool_input: { command: 'git status' } },
    },
    {
      label: 'write guard',
      path: writeLauncher,
      payload: { session_id: 'helper-shadow-write', cwd, tool_name: 'Write', tool_input: { file_path: join(workspace, 'safe.txt'), content: 'safe' } },
    },
  ];
  for (const entry of entries) {
    const result = await runProcess(`helper-shadow-safe ${entry.label}`, '/bin/bash', ['-p', entry.path], {
      cwd,
      env: {
        ...process.env,
        PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
        CLAUDE_PROJECT_DIR: workspace,
      },
      input: JSON.stringify(entry.payload),
    });
    assert.equal(result.ok, true, `${entry.label}: ${result.stderr}`);
  }
  for (const marker of markers) await assert.rejects(readFile(marker, 'utf8'), { code: 'ENOENT' });
});

test('Bash stdin hook resolves relative PATH entries from the effective cwd', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-relative-shadow-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  const bin = join(workspace, 'bin');
  await mkdir(bin);
  const shadow = join(bin, process.platform === 'win32' ? 'git.cmd' : 'git');
  await writeFile(shadow, process.platform === 'win32' ? '@echo off\r\nexit /b 0\r\n' : '#!/bin/sh\nexit 0\n');
  if (process.platform !== 'win32') await chmod(shadow, 0o755);

  const result = await runHook({
    command: 'git status',
    cwd,
    projectRoot: workspace,
    sessionId: 'relative-shadow',
    env: { PATH: `../../bin${delimiter}${process.env.PATH ?? ''}` },
  });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /executable resolves inside the workspace/u);
});

test('Bash stdin hook rejects an effective cwd outside the project root', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-outside-root-');
  const outside = await mkdtemp(join(tmpdir(), 'nova-pre-bash-outside-cwd-'));
  t.after(() => Promise.all([
    rm(workspace, { recursive: true, force: true }),
    rm(outside, { recursive: true, force: true }),
  ]));

  const result = await runHook({ command: 'git status', cwd: outside, projectRoot: workspace, sessionId: 'outside-root' });
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Bash cwd is outside the project root/u);
});

test('Bash stdin hook pins the root project policy across nested-cwd calls', async (t) => {
  const workspace = await createWorkspace('nova-pre-bash-session-');
  t.after(() => rm(workspace, { recursive: true, force: true }));
  const cwd = join(workspace, 'packages', 'nested');
  const policyPath = join(workspace, '.nova', 'shell-policy.json');
  await writeFile(policyPath, policy([
    { id: 'first-check', argv: ['npm', 'run', 'first-check'], purpose: 'First reviewed command.' },
  ]));

  const first = await runHook({ command: 'npm run first-check', cwd, projectRoot: workspace, sessionId: 'pinned-policy' });
  assert.equal(first.ok, true, first.stderr);

  await writeFile(policyPath, policy([
    { id: 'second-check', argv: ['npm', 'run', 'second-check'], purpose: 'Changed command.' },
  ]));
  const second = await runHook({ command: 'npm run second-check', cwd, projectRoot: workspace, sessionId: 'pinned-policy' });
  assert.equal(second.code, 2);
  assert.match(second.stderr, /shell policy changed after the session policy was pinned/u);
});

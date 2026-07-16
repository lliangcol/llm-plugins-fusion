import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, resolve } from 'node:path';
import test from 'node:test';
import {
  authorizeBashCommand,
  rejectedEnvironmentForExecutable,
  tokenizeShellCommand,
  validateBashCommand,
} from '../../nova-plugin/hooks/scripts/pre-bash-check.mjs';

const guardedEnvironmentVariables = [
  'BASH_ENV',
  'ENV',
  'PAGER',
  'RIPGREP_CONFIG_PATH',
];

function cleanGuardEnvironment(overrides = {}) {
  const env = { ...process.env };
  for (const variable of Object.keys(env)) {
    if (guardedEnvironmentVariables.includes(variable)
      || variable.toUpperCase().startsWith('GIT_')
      || variable.startsWith('BASH_FUNC_')) delete env[variable];
  }
  return { ...env, ...overrides };
}

test('Bash policy allows bounded validation and read-only inspection commands', () => {
  for (const command of ['npm test', 'npm run validate', 'node scripts/validate-all.mjs', 'git status --short', 'git diff --check', 'bash -n script.sh']) {
    assert.deepEqual(validateBashCommand(command, { env: cleanGuardEnvironment() }), [], command);
  }
});

test('Bash policy blocks common write-bypass and composition forms', () => {
  for (const command of ['cat secret > file', 'sed -i s/a/b/ file', 'python3 -c "open(\'x\',\'w\')"', 'git reset --hard', 'git -c alias.status=!id status', 'git --config-env=core.fsmonitor=ENV status', 'npm exec tool', 'node -e "writeFileSync(\'x\')"', 'npm test && rm -rf .', 'npm run not-reviewed', 'rg --pre helper pattern .', 'git diff --output=patch.txt', 'rg secret /etc', 'bash -n ../outside.sh', 'git --git-dir=/tmp/repo status', '/tmp/git status', './git status', 'foo/../git status', 'C:\\temp\\git.exe status', '/usr/bin/node --version', 'git status *', 'rg pattern {a,b}', 'rg pattern ~', 'rg pattern ?.js', 'rg pattern [ab].js']) {
    assert.notDeepEqual(validateBashCommand(command), [], command);
  }
});

test('Bash policy tokenizes quotes but rejects expansion and broken syntax', () => {
  assert.deepEqual(tokenizeShellCommand('rg "two words" src'), ['rg', 'two words', 'src']);
  assert.notDeepEqual(validateBashCommand('rg "$SECRET" src'), []);
  assert.notDeepEqual(validateBashCommand('rg "unterminated'), []);
  assert.deepEqual(tokenizeShellCommand("rg '*.js' src"), ['rg', '*.js', 'src']);
});

test('Bash tokenizer remains fail-closed under deterministic quote and separator fuzz', () => {
  let state = 0x4e4f5641;
  const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0);
  const hazards = ['*', '?', '{a,b}', '~', '$HOME', '$(id)', '<(id)', '>', '|', ';', '\n'];
  for (let index = 0; index < 256; index += 1) {
    const hazard = hazards[next() % hazards.length];
    const command = `git status ${hazard}`;
    assert.equal(authorizeBashCommand(command).allowed, false, command);
  }
});

test('Bash policy accepts only exact reviewed project argv entries', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-policy-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(resolve(workspace, '.nova'));
  writeFileSync(resolve(workspace, '.nova/shell-policy.json'), JSON.stringify({ schemaVersion: 1, allowCommands: [{ id: 'project-check', argv: ['npm', 'run', 'check'], purpose: 'Validated project check.' }] }));
  assert.deepEqual(authorizeBashCommand('npm run check', { workspaceRoot: workspace }), { allowed: true, source: 'project-exact-policy', ruleId: 'project-check', reasons: [] });
  assert.equal(authorizeBashCommand('npm run check -- --write', { workspaceRoot: workspace }).allowed, false);
});

test('Bash policy pins project policy bytes for the session', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-session-'));
  const stateRoot = resolve(workspace, 'session-state');
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(resolve(workspace, '.nova'));
  const policyPath = resolve(workspace, '.nova/shell-policy.json');
  writeFileSync(policyPath, JSON.stringify({ schemaVersion: 1, allowCommands: [{ id: 'project-check', argv: ['npm', 'run', 'check'], purpose: 'Validated project check.' }] }));
  assert.equal(authorizeBashCommand('npm run check', { workspaceRoot: workspace, sessionId: 'session-1', stateRoot }).allowed, true);
  writeFileSync(policyPath, JSON.stringify({ schemaVersion: 1, allowCommands: [{ id: 'project-test', argv: ['npm', 'test'], purpose: 'Changed during session.' }] }));
  assert.match(authorizeBashCommand('npm test', { workspaceRoot: workspace, sessionId: 'session-1', stateRoot }).reasons.join(' '), /policy changed/u);
});

test('Bash policy rejects workspace PATH shadowing', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-shadow-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const bin = resolve(workspace, 'bin');
  mkdirSync(bin);
  const shadow = resolve(bin, process.platform === 'win32' ? 'git.cmd' : 'git');
  writeFileSync(shadow, '#!/bin/sh\nexit 0\n');
  chmodSync(shadow, 0o755);
  const decision = authorizeBashCommand('git status', { workspaceRoot: workspace, env: cleanGuardEnvironment({ PATH: `${bin}` }) });
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(' '), /inside the workspace/u);
});

test('Bash policy skips non-executable PATH candidates before checking workspace shadows', { skip: process.platform === 'win32' }, (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-executable-shadow-'));
  const externalBin = mkdtempSync(resolve(tmpdir(), 'nova-shell-non-executable-bin-'));
  t.after(() => {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(externalBin, { recursive: true, force: true });
  });
  const workspaceBin = resolve(workspace, 'bin');
  mkdirSync(workspaceBin);
  const placeholder = resolve(externalBin, 'git');
  const shadow = resolve(workspaceBin, 'git');
  writeFileSync(placeholder, '#!/bin/sh\nexit 0\n');
  chmodSync(placeholder, 0o644);
  writeFileSync(shadow, '#!/bin/sh\nexit 0\n');
  chmodSync(shadow, 0o755);

  const decision = authorizeBashCommand('git status', {
    workspaceRoot: workspace,
    env: cleanGuardEnvironment({ PATH: `${externalBin}${delimiter}${workspaceBin}` }),
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(' '), /executable resolves inside the workspace/u);
});

test('Bash policy rejects exported functions that override the command token', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-function-override-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const decision = authorizeBashCommand('git status', {
    workspaceRoot: workspace,
    env: cleanGuardEnvironment({ 'BASH_FUNC_git%%': '() { echo shadow; }' }),
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(' '), /exported Bash function overrides executable resolution: git/u);
});

test('Bash policy rejects inherited shell startup files', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-startup-file-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  for (const variable of ['BASH_ENV', 'ENV']) {
    const decision = authorizeBashCommand('git status', {
      workspaceRoot: workspace,
      env: cleanGuardEnvironment({ [variable]: resolve(workspace, 'hostile-startup.sh') }),
    });
    assert.equal(decision.allowed, false, variable);
    assert.match(decision.reasons.join(' '), new RegExp(`${variable} is not allowed for guarded Bash execution`, 'u'));
  }
});

test('Bash policy rejects executable-specific environment injection', () => {
  const gitVariables = [
    'GIT_EXTERNAL_DIFF',
    'GIT_CONFIG_COUNT',
    'GIT_CONFIG_KEY_7',
    'GIT_CONFIG_VALUE_7',
    'GIT_CONFIG_SYSTEM',
    'GIT_CONFIG_GLOBAL',
    'GIT_CONFIG_PARAMETERS',
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_EXEC_PATH',
    'GIT_TRACE',
    'GIT_PAGER',
    'PAGER',
  ];
  for (const variable of gitVariables) {
    const env = cleanGuardEnvironment({ [variable]: 'hostile-value' });
    assert.deepEqual(rejectedEnvironmentForExecutable('git', env), [variable], variable);
    const decision = authorizeBashCommand('git status', { env });
    assert.equal(decision.allowed, false, variable);
    assert.match(decision.reasons.join(' '), new RegExp(`${variable} is not allowed for guarded git execution`, 'u'));
  }

  const ripgrepEnv = cleanGuardEnvironment({ RIPGREP_CONFIG_PATH: 'hostile-ripgrep.conf' });
  assert.deepEqual(rejectedEnvironmentForExecutable('rg', ripgrepEnv), ['RIPGREP_CONFIG_PATH']);
  const ripgrep = authorizeBashCommand('rg pattern .', { env: ripgrepEnv });
  assert.equal(ripgrep.allowed, false);
  assert.match(ripgrep.reasons.join(' '), /RIPGREP_CONFIG_PATH is not allowed for guarded rg execution/u);

  const pagerIsGitScoped = cleanGuardEnvironment({ PAGER: 'cat' });
  assert.deepEqual(rejectedEnvironmentForExecutable('rg', pagerIsGitScoped), []);
  assert.equal(authorizeBashCommand('rg pattern .', { env: pagerIsGitScoped }).allowed, true);

  const trustedPagerEnvironment = cleanGuardEnvironment({ GIT_PAGER: 'cat', PAGER: 'cat' });
  assert.deepEqual(rejectedEnvironmentForExecutable('git', trustedPagerEnvironment), []);
  assert.equal(authorizeBashCommand('git status', { env: trustedPagerEnvironment }).allowed, true);
});

test('Bash policy validates literal cat pager identity and function state', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-pager-shadow-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const bin = resolve(workspace, 'bin');
  mkdirSync(bin);
  const shadow = resolve(bin, process.platform === 'win32' ? 'cat.cmd' : 'cat');
  writeFileSync(shadow, process.platform === 'win32' ? '@echo off\r\nexit /b 0\r\n' : '#!/bin/sh\nexit 0\n');
  chmodSync(shadow, 0o755);

  const pagerShadow = authorizeBashCommand('git status', {
    workspaceRoot: workspace,
    env: cleanGuardEnvironment({
      PATH: `${bin}${delimiter}${process.env.PATH ?? ''}`,
      GIT_PAGER: 'cat',
      PAGER: 'cat',
    }),
  });
  assert.equal(pagerShadow.allowed, false);
  assert.match(pagerShadow.reasons.join(' '), /trusted Git pager cat.*inside the workspace/u);

  const functionOverride = authorizeBashCommand('git status', {
    workspaceRoot: workspace,
    env: cleanGuardEnvironment({
      GIT_PAGER: 'cat',
      PAGER: 'cat',
      'BASH_FUNC_cat%%': '() { echo shadow; }',
    }),
  });
  assert.equal(functionOverride.allowed, false);
  assert.match(functionOverride.reasons.join(' '), /exported Bash function overrides the trusted Git pager/u);
});

test('Bash policy evaluates read-only rules without depending on runner tools', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-read-only-workspace-'));
  const externalBin = mkdtempSync(resolve(tmpdir(), 'nova-shell-read-only-bin-'));
  t.after(() => {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(externalBin, { recursive: true, force: true });
  });
  const executable = resolve(externalBin, process.platform === 'win32' ? 'inspect.cmd' : 'inspect');
  writeFileSync(executable, '#!/bin/sh\nexit 0\n');
  chmodSync(executable, 0o755);
  const basePolicy = {
    maxCommandBytes: 1000,
    projectPolicyPath: '.nova/missing.json',
    rules: [{ id: 'inspect-read-only', type: 'read-only-executable', executables: ['inspect'], forbiddenArguments: ['--write'] }],
  };
  const options = { workspaceRoot: workspace, basePolicy, env: { ...process.env, PATH: externalBin } };
  assert.deepEqual(authorizeBashCommand('inspect target', options), {
    allowed: true,
    source: 'distributed-policy',
    ruleId: 'inspect-read-only',
    reasons: [],
  });
  assert.equal(authorizeBashCommand('inspect --write=target', options).allowed, false);
});

test('Bash policy fails closed for missing executables and unknown rule types', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-missing-'));
  const emptyPath = resolve(workspace, 'empty-bin');
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(emptyPath);
  const missing = authorizeBashCommand('git status', { workspaceRoot: workspace, env: cleanGuardEnvironment({ PATH: emptyPath }) });
  assert.equal(missing.allowed, false);
  assert.match(missing.reasons.join(' '), /not found on PATH/u);
  const unknownPolicy = { maxCommandBytes: 1000, projectPolicyPath: '.nova/missing.json', rules: [{ id: 'future', type: 'future-rule' }] };
  const unknown = authorizeBashCommand('git status', { workspaceRoot: workspace, basePolicy: unknownPolicy, env: cleanGuardEnvironment() });
  assert.equal(unknown.allowed, false);
});

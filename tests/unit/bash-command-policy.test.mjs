import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { authorizeBashCommand, tokenizeShellCommand, validateBashCommand } from '../../nova-plugin/hooks/scripts/pre-bash-check.mjs';

test('Bash policy allows bounded validation and read-only inspection commands', () => {
  for (const command of ['npm test', 'npm run validate', 'node scripts/validate-all.mjs', 'git status --short', 'git diff --check', 'bash -n script.sh']) {
    assert.deepEqual(validateBashCommand(command), [], command);
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
  const shadow = resolve(bin, 'git');
  writeFileSync(shadow, '#!/bin/sh\nexit 0\n');
  chmodSync(shadow, 0o755);
  const decision = authorizeBashCommand('git status', { workspaceRoot: workspace, env: { ...process.env, PATH: `${bin}` } });
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(' '), /inside the workspace/u);
});

test('Bash policy evaluates read-only rules without depending on runner tools', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-read-only-workspace-'));
  const externalBin = mkdtempSync(resolve(tmpdir(), 'nova-shell-read-only-bin-'));
  t.after(() => {
    rmSync(workspace, { recursive: true, force: true });
    rmSync(externalBin, { recursive: true, force: true });
  });
  const executable = resolve(externalBin, 'inspect');
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
  const missing = authorizeBashCommand('git status', { workspaceRoot: workspace, env: { ...process.env, PATH: emptyPath } });
  assert.equal(missing.allowed, false);
  assert.match(missing.reasons.join(' '), /not found on PATH/u);
  const unknownPolicy = { maxCommandBytes: 1000, projectPolicyPath: '.nova/missing.json', rules: [{ id: 'future', type: 'future-rule' }] };
  const unknown = authorizeBashCommand('git status', { workspaceRoot: workspace, basePolicy: unknownPolicy });
  assert.equal(unknown.allowed, false);
});

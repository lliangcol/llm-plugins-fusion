import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
  for (const command of ['cat secret > file', 'sed -i s/a/b/ file', 'python3 -c "open(\'x\',\'w\')"', 'git reset --hard', 'npm exec tool', 'node -e "writeFileSync(\'x\')"', 'npm test && rm -rf .', 'npm run not-reviewed', 'rg --pre helper pattern .', 'git diff --output=patch.txt', 'rg secret /etc', 'bash -n ../outside.sh', 'git --git-dir=/tmp/repo status', '/tmp/git status', './git status', 'foo/../git status', 'C:\\temp\\git.exe status', '/usr/bin/node --version', 'git status *', 'rg pattern {a,b}', 'rg pattern ~', 'rg pattern ?.js', 'rg pattern [ab].js']) {
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

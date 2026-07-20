import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, linkSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, resolve } from 'node:path';
import test from 'node:test';
import {
  authorizeBashCommand,
  rejectedEnvironmentForExecutable,
  repositoryGitConfigFindings,
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
  for (const command of ['cat secret > file', 'sed -i s/a/b/ file', 'python3 -c "open(\'x\',\'w\')"', 'git reset --hard', 'git -c alias.status=!id status', 'git --config-env=core.fsmonitor=ENV status', 'npm exec tool', 'node -e "writeFileSync(\'x\')"', 'npm test && rm -rf .', 'npm run not-reviewed', 'rg --pre helper pattern .', 'rg --hostname-bin=/usr/bin/id pattern .', 'rg --follow pattern .', 'rg -L pattern .', 'rg -nL pattern .', 'git diff --output=patch.txt', 'git diff --ext-diff', 'git show --textconv HEAD:file.txt', 'git log --show-signature', 'git status --help', 'git status -h', 'git log --remerge-diff', 'git log --diff-merges=remerge', 'git show --submodule=diff', 'git ls-files --recurse-submodules', 'git describe --always --dirty', 'git describe --always --broken', 'git log --alternate-refs -1', 'git log --format=%G?', 'git show --pretty=format:%GG', 'rg secret /etc', 'bash -n ../outside.sh', 'git --git-dir=/tmp/repo status', '/tmp/git status', './git status', 'foo/../git status', 'C:\\temp\\git.exe status', '/usr/bin/node --version', 'git status *', 'rg pattern {a,b}', 'rg pattern ~', 'rg pattern ?.js', 'rg pattern [ab].js']) {
    assert.notDeepEqual(validateBashCommand(command), [], command);
  }
});

test('Bash policy rejects full forbidden Git long options and every non-empty abbreviation', () => {
  const commands = [
    'git diff --output=patch.txt',
    'git diff --out=patch.txt',
    'git diff --o=patch.txt',
    'git describe --always --dirty',
    'git describe --always --dirt',
    'git describe --always --dir',
    'git describe --always --broken',
    'git describe --always --brok',
  ];
  for (const command of commands) {
    const decision = authorizeBashCommand(command, { env: cleanGuardEnvironment() });
    assert.equal(decision.allowed, false, command);
  }
});

test('Bash policy rejects ripgrep reads through workspace symlinks', { skip: process.platform === 'win32' }, (t) => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'nova-shell-ripgrep-link-'));
  const workspace = resolve(fixture, 'workspace');
  const outside = resolve(fixture, 'outside.txt');
  mkdirSync(workspace);
  writeFileSync(outside, 'outside\n');
  symlinkSync(outside, resolve(workspace, 'linked.txt'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));

  for (const command of ['rg outside linked.txt', 'rg --file=linked.txt pattern .', 'rg pattern -- linked.txt']) {
    const decision = authorizeBashCommand(command, { workspaceRoot: workspace, env: cleanGuardEnvironment() });
    assert.equal(decision.allowed, false, command);
    assert.match(decision.reasons.join(' '), /ripgrep read path contains a symlink or junction/u, command);
  }
});

test('Bash policy detects helper-capable configuration in bare Git repositories', { skip: process.platform === 'win32' }, (t) => {
  const bare = mkdtempSync(resolve(tmpdir(), 'nova-shell-bare-git-'));
  t.after(() => rmSync(bare, { recursive: true, force: true }));
  const git = (args) => spawnSync('git', args, { cwd: bare, encoding: 'utf8', env: cleanGuardEnvironment() });
  if (git(['--version']).status !== 0) { t.skip('Git is unavailable'); return; }
  assert.equal(git(['init', '--bare', '--quiet', '.']).status, 0);
  assert.equal(git(['config', 'diff.external', '/bin/echo']).status, 0);

  assert.match(repositoryGitConfigFindings(bare, 'diff', {
    effectiveCwd: bare,
    env: cleanGuardEnvironment(),
  }).join(' '), /repository-local Git config can invoke a helper via diff\.external/u);
  const decision = authorizeBashCommand('git diff --no-index config HEAD', {
    workspaceRoot: bare,
    env: cleanGuardEnvironment(),
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(' '), /repository-local Git config can invoke a helper via diff\.external/u);
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

test('Bash policy fails closed when repository-local Git config can launch helpers', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-git-config-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(resolve(workspace, '.git'));
  const marker = resolve(workspace, 'helper-ran');
  const helper = resolve(workspace, 'harmless-helper.sh');
  writeFileSync(helper, `#!/bin/sh\nprintf helper > ${JSON.stringify(marker)}\n`);
  chmodSync(helper, 0o755);
  writeFileSync(resolve(workspace, '.gitattributes'), '*.txt diff=fixture filter=fixture\n');
  const cases = [
    ['core.pager', `[core]\n\tpager = ${helper}\n`, 'git log -1'],
    ['core.hookspath', `[core]\n\thooksPath = ${helper}\n`, 'git status'],
    ['pager.status', `[pager]\n\tstatus = true\n`, 'git status'],
    ['core.fsmonitor', `[core]\n\tfsmonitor = ${helper}\n`, 'git status'],
    ['core.fsmonitor', `[core]\n\tfsmonitor = ${helper}\n`, 'git ls-files'],
    ['diff.external', `[diff]\n\texternal = ${helper}\n`, 'git diff'],
    ['diff.command', `[diff "fixture"]\n\tcommand = ${helper}\n`, 'git diff'],
    ['diff.textconv', `[diff "fixture"]\n\ttextconv = ${helper}\n`, 'git diff'],
    ['filter.process', `[filter "fixture"]\n\tprocess = ${helper}\n`, 'git status'],
    ['gpg.program', `[gpg "ssh"]\n\tprogram = ${helper}\n`, 'git log -1'],
    ['format.pretty', `[format]\n\tpretty = format:%GG\n`, 'git log -1'],
    ['pretty.audit', `[pretty]\n\taudit = format:%G?\n`, 'git show -1'],
    ['include.path', `[include]\n\tpath = ${helper}\n`, 'git status'],
    ['submodule.active', '[submodule "nested"]\n\tactive = true\n\turl = https://example.invalid/nested.git\n', 'git status'],
    ['extensions.partialclone', '[extensions]\n\tpartialClone = origin\n[remote "origin"]\n\tpromisor = true\n\turl = ext::harmless-helper\n', 'git show HEAD'],
  ];
  for (const [key, config, command] of cases) {
    writeFileSync(resolve(workspace, '.git/config'), config);
    assert.match(repositoryGitConfigFindings(workspace).join(' '), new RegExp(key.replace('.', '\\.'), 'u'), key);
    const decision = authorizeBashCommand(command, { workspaceRoot: workspace, env: cleanGuardEnvironment() });
    assert.equal(decision.allowed, false, key);
    assert.match(decision.reasons.join(' '), /repository-local Git config can invoke a helper/u, key);
    assert.equal(existsSync(marker), false, `${key} helper must not execute during authorization`);
  }
});

test('Bash policy inspects the Git repository discovered from the effective cwd and never above the project root', (t) => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'nova-shell-git-discovery-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const project = resolve(fixture, 'project');
  const nested = resolve(project, 'nested/worktree');
  mkdirSync(nested, { recursive: true });
  mkdirSync(resolve(project, 'nested/.git'));
  writeFileSync(resolve(project, 'nested/.git/config'), '[core]\n\tfsmonitor = nested-helper\n');

  const nestedDecision = authorizeBashCommand('git status --short', {
    projectRoot: project,
    effectiveCwd: nested,
    env: cleanGuardEnvironment(),
  });
  assert.equal(nestedDecision.allowed, false);
  assert.match(nestedDecision.reasons.join(' '), /core\.fsmonitor/u);

  rmSync(resolve(project, 'nested/.git'), { recursive: true, force: true });
  mkdirSync(resolve(fixture, '.git'));
  writeFileSync(resolve(fixture, '.git/config'), '[core]\n\tfsmonitor = outer-helper\n');
  const ancestorDecision = authorizeBashCommand('git status --short', {
    projectRoot: project,
    effectiveCwd: nested,
    env: cleanGuardEnvironment(),
  });
  assert.equal(ancestorDecision.allowed, false);
  assert.match(ancestorDecision.reasons.join(' '), /outside the project root/u);
});

test('Bash policy inspects inherited user Git configuration before allowing repository reads', (t) => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'nova-shell-global-git-config-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const workspace = resolve(fixture, 'workspace');
  const home = resolve(fixture, 'home');
  mkdirSync(resolve(workspace, '.git'), { recursive: true });
  mkdirSync(home);
  writeFileSync(resolve(workspace, '.git/config'), '[core]\n\trepositoryformatversion = 0\n');
  writeFileSync(resolve(home, '.gitconfig'), '[core]\n\tfsmonitor = inherited-helper\n');

  const decision = authorizeBashCommand('git status --short', {
    workspaceRoot: workspace,
    env: cleanGuardEnvironment({ HOME: home, XDG_CONFIG_HOME: resolve(home, '.config') }),
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(' '), /user Git config can invoke a helper via core\.fsmonitor/u);
});

test('Bash policy inspects XDG Git configuration without HOME and rejects linked config identities', { skip: process.platform === 'win32' }, (t) => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'nova-shell-xdg-git-config-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const workspace = resolve(fixture, 'workspace');
  const xdg = resolve(fixture, 'xdg');
  const config = resolve(xdg, 'git/config');
  mkdirSync(resolve(workspace, '.git'), { recursive: true });
  mkdirSync(resolve(xdg, 'git'), { recursive: true });
  writeFileSync(resolve(workspace, '.git/config'), '[core]\n\trepositoryformatversion = 0\n');
  writeFileSync(config, '[diff]\n\texternal = inherited-helper\n');
  const xdgOnlyEnvironment = cleanGuardEnvironment({ XDG_CONFIG_HOME: xdg });
  delete xdgOnlyEnvironment.HOME;
  delete xdgOnlyEnvironment.USERPROFILE;

  const decision = authorizeBashCommand('git diff', {
    workspaceRoot: workspace,
    env: xdgOnlyEnvironment,
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(' '), /user Git config can invoke a helper via diff\.external/u);

  const relativeXdg = { ...xdgOnlyEnvironment, XDG_CONFIG_HOME: 'relative-config' };
  const relativeDecision = authorizeBashCommand('git diff', { workspaceRoot: workspace, env: relativeXdg });
  assert.equal(relativeDecision.allowed, false);
  assert.match(relativeDecision.reasons.join(' '), /XDG_CONFIG_HOME must be absolute/u);

  const external = resolve(fixture, 'external-config');
  writeFileSync(external, '[diff]\n\texternal = linked-helper\n');
  unlinkSync(config);
  symlinkSync(external, config);
  const linkedDecision = authorizeBashCommand('git diff', { workspaceRoot: workspace, env: xdgOnlyEnvironment });
  assert.equal(linkedDecision.allowed, false);
  assert.match(linkedDecision.reasons.join(' '), /single-link regular physical file/u);

  unlinkSync(config);
  linkSync(external, config);
  const hardLinkedDecision = authorizeBashCommand('git diff', { workspaceRoot: workspace, env: xdgOnlyEnvironment });
  assert.equal(hardLinkedDecision.allowed, false);
  assert.match(hardLinkedDecision.reasons.join(' '), /single-link regular physical file/u);
});

test('guarded Git config covers helpers that real log and ls-files commands can execute', { skip: process.platform === 'win32' }, (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-git-real-helper-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const marker = resolve(workspace, 'helper-ran');
  const helper = resolve(workspace, 'helper.sh');
  writeFileSync(helper, `#!/bin/sh\nprintf helper > ${JSON.stringify(marker)}\nexit 1\n`);
  chmodSync(helper, 0o755);
  const git = (args, input = undefined) => spawnSync('git', args, {
    cwd: workspace,
    encoding: 'utf8',
    input,
    env: cleanGuardEnvironment(),
  });
  if (git(['--version']).status !== 0) { t.skip('Git is unavailable'); return; }
  assert.equal(git(['init', '--quiet']).status, 0);
  writeFileSync(resolve(workspace, 'tracked.txt'), 'tracked\n');
  assert.equal(git(['add', 'tracked.txt']).status, 0);
  const tree = git(['write-tree']).stdout.trim();
  const signedCommit = [
    `tree ${tree}`,
    'author Fixture <fixture@example.invalid> 946684800 +0000',
    'committer Fixture <fixture@example.invalid> 946684800 +0000',
    'gpgsig -----BEGIN PGP SIGNATURE-----',
    ' fake-signature',
    ' -----END PGP SIGNATURE-----',
    '',
    'Signed fixture',
    '',
  ].join('\n');
  const commit = git(['hash-object', '-t', 'commit', '-w', '--stdin'], signedCommit).stdout.trim();
  assert.match(commit, /^[a-f0-9]{40,64}$/u);
  assert.equal(git(['update-ref', 'HEAD', commit]).status, 0);

  assert.equal(git(['config', 'gpg.program', helper]).status, 0);
  git(['log', '-1', '--format=%G?']);
  assert.equal(existsSync(marker), true, 'signature formatting must reach gpg.program in the unguarded Git process');
  unlinkSync(marker);
  const gpgDecision = authorizeBashCommand('git log -1 --format=%G?', { workspaceRoot: workspace, env: cleanGuardEnvironment() });
  assert.equal(gpgDecision.allowed, false);
  assert.equal(existsSync(marker), false, 'authorization must not execute gpg.program');

  assert.equal(git(['config', '--unset', 'gpg.program']).status, 0);
  assert.equal(git(['config', 'core.fsmonitor', helper]).status, 0);
  git(['ls-files']);
  assert.equal(existsSync(marker), true, 'ls-files must reach core.fsmonitor in the unguarded Git process');
  unlinkSync(marker);
  const fsmonitorDecision = authorizeBashCommand('git ls-files', { workspaceRoot: workspace, env: cleanGuardEnvironment() });
  assert.equal(fsmonitorDecision.allowed, false);
  assert.equal(existsSync(marker), false, 'authorization must not execute core.fsmonitor');
});

test('guarded Git describe rejects abbreviated dirtiness options and filter configuration before execution', { skip: process.platform === 'win32' }, (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-git-describe-filter-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const marker = resolve(workspace, 'helper-ran');
  const helper = resolve(workspace, 'clean-filter.sh');
  const git = (args) => spawnSync('git', args, {
    cwd: workspace,
    encoding: 'utf8',
    env: cleanGuardEnvironment(),
  });
  if (git(['--version']).status !== 0) { t.skip('Git is unavailable'); return; }
  assert.equal(git(['init', '--quiet']).status, 0);
  assert.equal(git(['config', 'user.name', 'Fixture']).status, 0);
  assert.equal(git(['config', 'user.email', 'fixture@example.invalid']).status, 0);
  writeFileSync(resolve(workspace, '.gitattributes'), 'payload.txt filter=fixture\n');
  writeFileSync(resolve(workspace, 'payload.txt'), 'initial\n');
  assert.equal(git(['add', '.gitattributes', 'payload.txt']).status, 0);
  assert.equal(git(['commit', '--quiet', '-m', 'fixture']).status, 0);
  assert.equal(git(['tag', 'v1.0.0']).status, 0);
  writeFileSync(helper, `#!/bin/sh\nprintf helper > ${JSON.stringify(marker)}\ncat\n`);
  chmodSync(helper, 0o755);
  assert.equal(git(['config', 'filter.fixture.clean', helper]).status, 0);
  writeFileSync(resolve(workspace, 'payload.txt'), 'changed\n');

  for (const command of ['git describe --tags --always', 'git describe --tags --dir', 'git describe --tags --brok']) {
    const decision = authorizeBashCommand(command, {
      workspaceRoot: workspace,
      env: cleanGuardEnvironment(),
    });
    assert.equal(decision.allowed, false, command);
    assert.equal(existsSync(marker), false, `${command} must not execute the filter during authorization`);
  }

  const observed = git(['describe', '--tags', '--dir']);
  assert.equal(observed.status, 0, observed.stderr);
  assert.equal(existsSync(marker), true, 'the same unguarded describe command reaches the clean filter');
});

test('Bash policy blocks the post-index-change hook that a read-only Git status can execute', { skip: process.platform === 'win32' }, (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-git-status-hook-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const marker = resolve(workspace, 'hook-ran');
  const git = (args) => spawnSync('git', args, {
    cwd: workspace,
    encoding: 'utf8',
    env: cleanGuardEnvironment(),
  });
  if (git(['--version']).status !== 0) { t.skip('Git is unavailable'); return; }
  assert.equal(git(['init', '--quiet']).status, 0);
  assert.equal(git(['config', 'user.name', 'Fixture']).status, 0);
  assert.equal(git(['config', 'user.email', 'fixture@example.invalid']).status, 0);
  const tracked = resolve(workspace, 'tracked.txt');
  writeFileSync(tracked, 'tracked\n');
  assert.equal(git(['add', 'tracked.txt']).status, 0);
  assert.equal(git(['commit', '--quiet', '-m', 'fixture']).status, 0);

  const hooksDirectory = resolve(workspace, '.git/hooks');
  const sample = resolve(hooksDirectory, 'post-index-change.sample');
  writeFileSync(sample, '#!/bin/sh\nexit 0\n');
  chmodSync(sample, 0o755);
  assert.equal(authorizeBashCommand('git status --short', {
    workspaceRoot: workspace,
    env: cleanGuardEnvironment(),
  }).allowed, true, 'a sample hook must not be treated as active');

  const hook = resolve(hooksDirectory, 'post-index-change');
  writeFileSync(hook, `#!/bin/sh\nprintf hook > ${JSON.stringify(marker)}\n`);
  chmodSync(hook, 0o755);
  const future = new Date(Date.now() + 10_000);
  utimesSync(tracked, future, future);

  const decision = authorizeBashCommand('git status --short', {
    workspaceRoot: workspace,
    env: cleanGuardEnvironment(),
  });
  assert.equal(decision.allowed, false);
  assert.match(decision.reasons.join(' '), /post-index-change/u);
  assert.equal(existsSync(marker), false, 'authorization must not execute the hook');

  assert.equal(git(['status', '--short']).status, 0);
  assert.equal(existsSync(marker), true, 'the same unguarded read-only status must reach the hook');
});

test('Bash policy blocks status and diff when repository submodules can expose nested hooks or helpers', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-git-submodules-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(resolve(workspace, '.git'));
  writeFileSync(resolve(workspace, '.git/config'), '[core]\n\trepositoryformatversion = 0\n');
  writeFileSync(resolve(workspace, '.gitmodules'), '[submodule "nested"]\n\tpath = nested\n\turl = https://example.invalid/nested.git\n');

  for (const command of ['git status --short', 'git diff --check']) {
    const decision = authorizeBashCommand(command, {
      workspaceRoot: workspace,
      env: cleanGuardEnvironment(),
    });
    assert.equal(decision.allowed, false, command);
    assert.match(decision.reasons.join(' '), /submodules.*nested Git hooks or helpers/u, command);
  }
  assert.equal(authorizeBashCommand('git rev-parse HEAD', {
    workspaceRoot: workspace,
    env: cleanGuardEnvironment(),
  }).allowed, true, 'an allowed subcommand that does not recurse into submodules remains available');
});

test('Bash policy permits ordinary repository-local Git metadata', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-git-config-benign-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(resolve(workspace, '.git'));
  writeFileSync(resolve(workspace, '.git/config'), [
    '[core]',
    '\trepositoryformatversion = 0',
    '\tfilemode = true',
    '\tfsmonitor = false # disabled',
    '[remote "origin"]',
    '\turl = https://example.invalid/repository.git',
    '\tfetch = +refs/heads/*:refs/remotes/origin/*',
    '[pager]',
    '\tstatus = false ; disabled',
    '[log]',
    '\tshowSignature = false # disabled',
    '[alias]',
    '\tinspect = log \\',
    '\t\t--oneline',
    '[credential]',
    '\thelper = harmless-unreachable-helper',
    '[filter "fixture"]',
    '\tsmudge = harmless-unreachable-helper',
    '[format]',
    '\tuseAutoBase = false',
    '[interactive]',
    '\tdiffFilter = harmless-unreachable-helper',
    '',
  ].join('\n'));
  assert.deepEqual(repositoryGitConfigFindings(workspace), []);
  assert.equal(authorizeBashCommand('git status --short', { workspaceRoot: workspace, env: cleanGuardEnvironment() }).allowed, true);
});

test('Bash policy ignores helper config that an allowed Git subcommand cannot reach', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-git-config-unreachable-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(resolve(workspace, '.git'));
  writeFileSync(resolve(workspace, '.git/config'), '[diff]\n\texternal = harmless-helper\n');
  assert.deepEqual(repositoryGitConfigFindings(workspace, 'rev-parse'), []);
  assert.equal(authorizeBashCommand('git rev-parse HEAD', { workspaceRoot: workspace, env: cleanGuardEnvironment() }).allowed, true);
  assert.match(repositoryGitConfigFindings(workspace, 'diff').join(' '), /diff\.external/u);
});

test('Bash policy inspects worktree config only when the Git extension enables it', (t) => {
  const workspace = mkdtempSync(resolve(tmpdir(), 'nova-shell-git-worktree-config-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  mkdirSync(resolve(workspace, '.git'));
  const commonConfig = resolve(workspace, '.git/config');
  writeFileSync(commonConfig, '[core]\n\trepositoryformatversion = 0\n');
  writeFileSync(resolve(workspace, '.git/config.worktree'), '[diff]\n\texternal = harmless-helper\n');

  assert.deepEqual(repositoryGitConfigFindings(workspace, 'diff'), []);
  assert.equal(authorizeBashCommand('git diff', { workspaceRoot: workspace, env: cleanGuardEnvironment() }).allowed, true);

  writeFileSync(commonConfig, '[extensions]\n\tworktreeConfig = true\n');
  assert.match(repositoryGitConfigFindings(workspace, 'diff').join(' '), /diff\.external/u);
  assert.equal(authorizeBashCommand('git diff', { workspaceRoot: workspace, env: cleanGuardEnvironment() }).allowed, false);
});

test('Bash policy safely resolves linked-worktree config and rejects malformed Git metadata', (t) => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'nova-shell-linked-worktree-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const workspace = resolve(fixture, 'workspace');
  const commonGitDir = resolve(fixture, 'git');
  const worktreeGitDir = resolve(commonGitDir, 'worktrees/workspace');
  mkdirSync(workspace);
  mkdirSync(worktreeGitDir, { recursive: true });
  writeFileSync(resolve(workspace, '.git'), 'gitdir: ../git/worktrees/workspace\n');
  writeFileSync(resolve(worktreeGitDir, 'commondir'), '../..\n');
  writeFileSync(resolve(commonGitDir, 'config'), [
    '[vendor]',
    '\tunsupported syntax \\',
    '\tcontinued value',
    '[extensions]',
    '\tworktreeConfig = true',
    '',
  ].join('\n'));
  writeFileSync(resolve(worktreeGitDir, 'config.worktree'), '[log]\n\tshowSignature = true\n');

  assert.match(repositoryGitConfigFindings(workspace, 'log').join(' '), /log\.showsignature/u);
  const linkedWorktree = authorizeBashCommand('git log -1', {
    workspaceRoot: workspace,
    env: cleanGuardEnvironment(),
  });
  assert.equal(linkedWorktree.allowed, false);
  assert.match(linkedWorktree.reasons.join(' '), /repository-local Git config can invoke a helper via log\.showsignature/u);

  const artifactRoot = resolve(fixture, 'artifacts');
  const artifactBin = resolve(artifactRoot, 'bin');
  mkdirSync(artifactBin, { recursive: true });
  const artifactCollision = authorizeBashCommand('git status', {
    workspaceRoot: workspace,
    artifactRoots: [artifactRoot],
    env: cleanGuardEnvironment({ PATH: `${artifactBin}${delimiter}${process.env.PATH ?? ''}` }),
  });
  assert.equal(artifactCollision.allowed, false);
  assert.match(artifactCollision.reasons.join(' '), /explicit artifact root conflicts.*contains executable PATH entry/u);

  writeFileSync(resolve(commonGitDir, 'config'), '[core]\n\tinvalid syntax here\n');
  const malformed = repositoryGitConfigFindings(workspace, 'status');
  assert.match(malformed.join(' '), /could not be inspected safely.*cannot be parsed on line 2/u);
  const malformedDecision = authorizeBashCommand('git status', {
    workspaceRoot: workspace,
    env: cleanGuardEnvironment(),
  });
  assert.equal(malformedDecision.allowed, false);
  assert.match(malformedDecision.reasons.join(' '), /could not be inspected safely.*cannot be parsed on line 2/u);
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

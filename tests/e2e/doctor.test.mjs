import assert from 'node:assert/strict';
import { delimiter, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';
import { parseSemVer } from '../../scripts/lib/semver.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '../..');

function hostHookEnvironment(overrides = {}) {
  const env = { ...process.env, ...overrides };
  env.PATH = String(env.PATH ?? '').split(delimiter).filter((entry) => {
    if (!entry) return false;
    const relation = relative(repoRoot, resolve(entry));
    return relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation);
  }).join(delimiter);
  return env;
}

test('doctor reports stable maintainer diagnostics without hard-requiring optional CLIs', async () => {
  const result = await runProcess('doctor', process.execPath, [
    'scripts/doctor.mjs',
  ], {
    cwd: repoRoot,
    env: hostHookEnvironment(),
    timeoutMs: 60_000,
  });

  assert.equal(result.ok, true, result.stderr || result.stdout);
  assert.match(result.stdout, /== doctor diagnostics ==/);
  assert.match(result.stdout, /^PASSED Node\.js \[CHECK_PASSED\]: /m);
  assert.match(result.stdout, /^PASSED Git \[CHECK_PASSED\]: /m);
  assert.match(result.stdout, /^(PASSED|SKIPPED) Bash \[/m);
  assert.match(result.stdout, /^PASSED Hook bootstrap Bash \[CHECK_PASSED\]: /m);
  assert.match(result.stdout, /^(PASSED|WARN) Write guard \[/m);
  assert.match(result.stdout, /^(PASSED|SKIPPED) Claude CLI \[/m);
  assert.match(result.stdout, /^(PASSED|SKIPPED) Codex CLI \[/m);
  const versionLine = result.stdout.match(/^PASSED Package\/plugin version \[CHECK_PASSED\]: (\S+)$/m);
  assert.ok(versionLine, 'doctor must report package and plugin versions');
  assert.ok(parseSemVer(versionLine[1]), `invalid package SemVer: ${versionLine[1]}`);
  assert.match(result.stdout, /^(PASSED|WARN) Git working tree \[/m);
  assert.match(result.stdout, /^(PASSED|WARN) Exact release tag \[/m);
  assert.match(result.stdout, /^PASSED Generated registry drift \[CHECK_PASSED\]: current$/m);
  assert.doesNotMatch(result.stdout, /^FAILED /m);
});

test('doctor JSON uses the shared diagnostic contract and registered reason codes', async () => {
  const result = await runProcess('doctor json', process.execPath, ['scripts/doctor.mjs', '--json'], { cwd: repoRoot, env: hostHookEnvironment(), timeoutMs: 60_000 });
  assert.equal(result.ok, true, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.command, 'doctor');
  assert.ok(report.results.every((entry) => entry.reasonCode && entry.docsUrl && entry.remediation));
  assert.equal(report.results.find((entry) => entry.check === 'Claude CLI').status === 'failed', false);
});

test('doctor and bootstrap reject the obsolete write-guard bypass', async () => {
  for (const [label, script, check] of [
    ['doctor', 'scripts/doctor.mjs', 'Write guard'],
    ['bootstrap', 'scripts/validate-bootstrap.mjs', 'write-guard-bypass'],
  ]) {
    const result = await runProcess(`${label} bypass rejection`, process.execPath, [script, '--json'], {
      cwd: repoRoot,
      env: hostHookEnvironment({ NOVA_WRITE_GUARD_DISABLED: '1' }),
      timeoutMs: 60_000,
    });
    assert.equal(result.code, 1, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    const finding = report.results.find((entry) => entry.check === check);
    assert.equal(finding?.status, 'failed');
    assert.equal(finding?.reasonCode, 'WRITE_GUARD_DISABLED');
  }
});

test('npm doctor and bootstrap normalize only the lifecycle-injected project bin', { skip: !process.env.npm_execpath }, async () => {
  for (const [label, script] of [['doctor', 'doctor'], ['bootstrap', 'validate:bootstrap']]) {
    const result = await runProcess(`npm ${label}`, process.execPath, [process.env.npm_execpath, '--silent', 'run', script, '--', '--json'], {
      cwd: repoRoot,
      env: hostHookEnvironment(),
      timeoutMs: 60_000,
    });
    assert.equal(result.code, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    const finding = report.results.find((entry) => /Diagnostic invocation PATH|diagnostic-invocation-path/u.test(entry.check));
    assert.equal(finding?.status, 'warn');
    assert.equal(finding?.reasonCode, 'NPM_LIFECYCLE_PATH_NORMALIZED');
    assert.equal(report.results.some((entry) => entry.reasonCode === 'HOOK_BOOTSTRAP_UNTRUSTED'), false);
  }
});

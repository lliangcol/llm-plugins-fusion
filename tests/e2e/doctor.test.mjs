import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';
import { parseSemVer } from '../../scripts/lib/semver.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '../..');

test('doctor reports stable maintainer diagnostics without hard-requiring optional CLIs', async () => {
  const result = await runProcess('doctor', process.execPath, [
    'scripts/doctor.mjs',
  ], {
    cwd: repoRoot,
    timeoutMs: 60_000,
  });

  assert.equal(result.ok, true, result.stderr || result.stdout);
  assert.match(result.stdout, /== doctor diagnostics ==/);
  assert.match(result.stdout, /^PASSED Node\.js \[CHECK_PASSED\]: /m);
  assert.match(result.stdout, /^PASSED Git \[CHECK_PASSED\]: /m);
  assert.match(result.stdout, /^(PASSED|SKIPPED) Bash \[/m);
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
  const result = await runProcess('doctor json', process.execPath, ['scripts/doctor.mjs', '--json'], { cwd: repoRoot, timeoutMs: 60_000 });
  assert.equal(result.ok, true, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, 1);
  assert.equal(report.command, 'doctor');
  assert.ok(report.results.every((entry) => entry.reasonCode && entry.docsUrl && entry.remediation));
  assert.equal(report.results.find((entry) => entry.check === 'Claude CLI').status === 'failed', false);
});

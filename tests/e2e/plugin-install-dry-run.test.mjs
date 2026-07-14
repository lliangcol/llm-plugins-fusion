import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '../..');

test('plugin install dry run does not invoke Claude CLI commands', async () => {
  const result = await runProcess('plugin install dry run', process.execPath, [
    'scripts/validate-plugin-install.mjs',
    '--dry-run',
  ], {
    cwd: repoRoot,
    timeoutMs: 30_000,
  });

  assert.equal(result.ok, true);
  assert.match(result.stdout, /Dry run only/);
  assert.match(result.stdout, /No Claude CLI commands were run/);
  assert.doesNotMatch(result.stdout, /^== claude/m);
});

test('plugin install dry run can preview isolated home mode without mutation', async () => {
  const result = await runProcess('plugin install isolated dry run', process.execPath, [
    'scripts/validate-plugin-install.mjs',
    '--dry-run',
    '--isolated-home',
  ], {
    cwd: repoRoot,
    timeoutMs: 30_000,
  });

  assert.equal(result.ok, true);
  assert.match(result.stdout, /Isolated home: enabled/);
  assert.match(result.stdout, /temporary HOME, USERPROFILE, XDG_CONFIG_HOME, XDG_DATA_HOME, and XDG_STATE_HOME/);
  assert.match(result.stdout, /No Claude CLI commands were run/);
  assert.doesNotMatch(result.stdout, /^== claude/m);
});

test('plugin install dry run exposes the shared JSON diagnostic contract', async () => {
  const result = await runProcess('plugin install diagnostic dry run', process.execPath, [
    'scripts/validate-plugin-install.mjs',
    '--dry-run',
    '--json',
  ], { cwd: repoRoot, timeoutMs: 30_000 });
  assert.equal(result.ok, true, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.command, 'validate-plugin-install --dry-run');
  assert.equal(report.status, 'passed');
  assert.equal(report.results[0].reasonCode, 'DRY_RUN_SAFE_PREVIEW');
});

test('plugin install diagnostic flags cannot silently no-op on the mutating path', async () => {
  const result = await runProcess('plugin install unsupported mutating diagnostics', process.execPath, [
    'scripts/validate-plugin-install.mjs',
    '--json',
  ], { cwd: repoRoot, timeoutMs: 30_000 });
  assert.equal(result.ok, false);
  assert.match(result.stderr, /supported only with --dry-run/u);
});

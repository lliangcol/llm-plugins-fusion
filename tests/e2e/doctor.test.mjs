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
  assert.match(result.stdout, /== llm-plugins-fusion doctor ==/);
  assert.match(result.stdout, /^OK Node\.js: /m);
  assert.match(result.stdout, /^OK Git: /m);
  assert.match(result.stdout, /^(OK|WARN) Bash: /m);
  assert.match(result.stdout, /^(OK|WARN) Claude CLI: /m);
  assert.match(result.stdout, /^(OK|WARN) Codex CLI: /m);
  const versionLine = result.stdout.match(/^OK Package\/plugin version: package=([^;]+); plugin=(\S+)$/m);
  assert.ok(versionLine, 'doctor must report package and plugin versions');
  assert.ok(parseSemVer(versionLine[1]), `invalid package SemVer: ${versionLine[1]}`);
  assert.equal(versionLine[2], versionLine[1]);
  assert.match(result.stdout, /^(OK|WARN) Git working tree: /m);
  assert.match(result.stdout, /^(OK|WARN) Exact release tag: /m);
  assert.match(result.stdout, /^OK Generated registry drift: generated outputs are current$/m);
  assert.match(result.stdout, /^Summary: errors=0 warnings=\d+$/m);
  assert.doesNotMatch(result.stdout, /^ERROR /m);
});

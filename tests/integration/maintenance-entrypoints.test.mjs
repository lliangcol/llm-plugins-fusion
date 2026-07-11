import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

for (const script of [
  'scripts/collect-github-metrics.mjs',
  'scripts/profile-validation.mjs',
  'scripts/run-node-tests.mjs',
  'scripts/run-test-coverage.mjs',
]) {
  test(`${script} exposes a non-mutating help path`, async () => {
    const result = await runProcess(`${script} help`, process.execPath, [script, '--help'], { cwd: repoRoot });
    assert.equal(result.ok, true, result.stderr);
    assert.match(result.stdout, /Usage:/);
  });
}

for (const script of ['scripts/demo-route.mjs', 'scripts/demo-review.mjs']) {
  test(`${script} runs deterministic public-safe output`, async () => {
    const result = await runProcess(`${script} demo`, process.execPath, [script], { cwd: repoRoot });
    assert.equal(result.ok, true, result.stderr);
    assert.match(result.stdout, /deterministic local fixture only/);
  });
}

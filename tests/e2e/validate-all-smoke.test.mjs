import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '../..');

test('validate-all smoke completes with zero failures', async () => {
  const result = await runProcess('validate-all smoke', process.execPath, [
    'scripts/validate-all.mjs',
  ], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NOVA_VALIDATE_CONCURRENCY: '2',
    },
    timeoutMs: 120_000,
  });

  assert.equal(result.ok, true);
  assert.match(result.stdout, /Summary: failed=0/);
  assert.match(result.stdout, /== validation timings ==/);
});

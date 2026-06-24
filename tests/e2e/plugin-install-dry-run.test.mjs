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

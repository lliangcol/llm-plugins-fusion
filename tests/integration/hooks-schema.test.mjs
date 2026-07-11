import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateHooksJsonText } from '../../nova-plugin/hooks/scripts/hooks-schema.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '../..');

test('distributed hooks.json satisfies the shared hook schema', async () => {
  const source = await readFile(resolve(repoRoot, 'nova-plugin/hooks/hooks.json'), 'utf8');
  const config = JSON.parse(source);
  const errors = validateHooksJsonText(source, {
    pluginRootDir: resolve(repoRoot, 'nova-plugin'),
  });

  assert.deepEqual(errors, []);
  assert.equal(config.hooks.PreToolUse[0].matcher, 'Write|Edit|NotebookEdit');
  assert.equal(config.hooks.PostToolUse[0].matcher, 'Write|Edit|NotebookEdit|Bash');
});

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
  assert.deepEqual(config.hooks.PostToolUse.map((entry) => entry.matcher), [
    'Write|Edit',
    'Write|Edit|NotebookEdit|Bash',
  ]);
  assert.equal(config.hooks.PostToolUseFailure[0].matcher, 'Write|Edit|NotebookEdit|Bash');
  assert.equal(config.hooks.PermissionDenied[0].matcher, 'Write|Edit|NotebookEdit|Bash');
  assert.equal(config.hooks.ConfigChange[0].matcher, 'project_settings|local_settings');
  for (const entry of config.hooks.PreToolUse) {
    assert.equal(entry.hooks[0].command, 'bash');
    assert.equal(entry.hooks[0].args[0], '-p');
    assert.equal(entry.hooks[0].args.length, 2);
  }
  for (const event of ['PostToolUse', 'PostToolUseFailure', 'PermissionDenied', 'ConfigChange', 'SessionEnd']) {
    for (const entry of config.hooks[event]) {
      assert.equal(entry.hooks[0].command, 'bash');
      assert.equal(entry.hooks[0].args[0], '-p');
      assert.match(entry.hooks[0].args[1], /trusted-node-hook\.sh$/u);
      assert.equal(entry.hooks[0].args.length, 3);
    }
  }
});

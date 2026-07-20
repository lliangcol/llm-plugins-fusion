import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { runProcess } from '../../scripts/lib/process-runner.mjs';

const root = resolve(import.meta.dirname, '../..');
const guard = resolve(root, 'nova-plugin/hooks/scripts/config-change-guard.mjs');

async function run(payload) {
  return runProcess('config change guard test', process.execPath, [guard], {
    cwd: root,
    input: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
}

test('ConfigChange guard blocks project and local settings changes for the active session', async () => {
  for (const source of ['project_settings', 'local_settings']) {
    const result = await run({
      hook_event_name: 'ConfigChange',
      source,
      file_path: source === 'project_settings' ? '.claude/settings.json' : '.claude/settings.local.json',
    });
    assert.equal(result.code, 2, result.stderr);
    assert.match(result.stderr, /changes are frozen for the active session/u);
  }
});

test('ConfigChange guard fails closed for malformed events and unexpected sources', async () => {
  for (const payload of [
    '{bad json',
    { hook_event_name: 'PreToolUse', source: 'project_settings' },
    { hook_event_name: 'ConfigChange', source: 'user_settings' },
  ]) {
    const result = await run(payload);
    assert.equal(result.code, 2, result.stderr);
    assert.match(result.stderr, /CONFIG_CHANGE_BLOCKED/u);
  }
});

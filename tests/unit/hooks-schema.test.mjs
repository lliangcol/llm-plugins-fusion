import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  validateHooksConfig,
  validateHooksJsonText,
} from '../../nova-plugin/hooks/scripts/hooks-schema.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '../..');
const pluginRootDir = resolve(repoRoot, 'nova-plugin');

function validConfig(overrides = {}) {
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Write|Edit|MultiEdit',
          hooks: [
            {
              type: 'command',
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh"',
              timeout: 10,
              statusMessage: 'checking write',
              ...overrides,
            },
          ],
        },
      ],
    },
  };
}

test('validateHooksConfig accepts the distributed hook shape', () => {
  const errors = validateHooksConfig(validConfig(), { pluginRootDir });
  assert.deepEqual(errors, []);
});

test('validateHooksConfig rejects missing matcher and invalid timeout', () => {
  const config = validConfig({ timeout: 0 });
  delete config.hooks.PreToolUse[0].matcher;

  const errors = validateHooksConfig(config, { pluginRootDir });

  assert(errors.some((error) => /missing matcher string/.test(error)));
  assert(errors.some((error) => /timeout must be a positive integer/.test(error)));
});

test('validateHooksConfig rejects shell scripts not invoked through explicit bash', () => {
  const errors = validateHooksConfig(validConfig({
    command: '"${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh"',
  }), { pluginRootDir });

  assert(errors.some((error) => /without explicit bash/.test(error)));
});

test('validateHooksConfig rejects unsupported fields and events', () => {
  const config = {
    hooks: {
      UnsupportedEvent: [
        {
          matcher: 'Write',
          extraEntry: true,
          hooks: [
            {
              type: 'command',
              command: 'bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh"',
              extraHook: true,
            },
          ],
        },
      ],
    },
  };

  const errors = validateHooksConfig(config, { pluginRootDir });

  assert(errors.some((error) => /not a supported nova-plugin hook event/.test(error)));
  assert(errors.some((error) => /contains unsupported field "extraEntry"/.test(error)));
  assert(errors.some((error) => /contains unsupported field "extraHook"/.test(error)));
});

test('validateHooksJsonText reports invalid JSON', () => {
  const errors = validateHooksJsonText('{bad json');
  assert(errors.some((error) => /not valid JSON/.test(error)));
});

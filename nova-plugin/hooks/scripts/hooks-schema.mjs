import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const SUPPORTED_EVENTS = new Set([
  'PreToolUse',
  'PostToolUse',
]);

const ENTRY_KEYS = new Set([
  'matcher',
  'hooks',
]);

const HOOK_KEYS = new Set([
  'type',
  'command',
  'timeout',
  'statusMessage',
  'async',
]);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function record(errors, message) {
  errors.push(`  - ${message}`);
}

function referencedHookScript(command) {
  const match = command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+\.sh)/);
  return match?.[1] ?? null;
}

export function validateHooksConfig(config, options = {}) {
  const { pluginRootDir } = options;
  const errors = [];

  if (!isPlainObject(config)) {
    record(errors, 'hooks.json must contain a JSON object');
    return errors;
  }

  const hooks = config.hooks;
  if (!isPlainObject(hooks)) {
    record(errors, 'missing hooks object');
    return errors;
  }

  for (const [event, entries] of Object.entries(hooks)) {
    if (!SUPPORTED_EVENTS.has(event)) {
      record(errors, `${event} is not a supported nova-plugin hook event`);
    }
    if (!Array.isArray(entries)) {
      record(errors, `${event} must be an array`);
      continue;
    }

    entries.forEach((entry, index) => {
      const entryLabel = `${event}[${index}]`;
      if (!isPlainObject(entry)) {
        record(errors, `${entryLabel} must be an object`);
        return;
      }
      for (const key of Object.keys(entry)) {
        if (!ENTRY_KEYS.has(key)) {
          record(errors, `${entryLabel} contains unsupported field "${key}"`);
        }
      }
      if (typeof entry.matcher !== 'string' || entry.matcher.trim() === '') {
        record(errors, `${entryLabel} missing matcher string`);
      }
      if (!Array.isArray(entry.hooks) || entry.hooks.length === 0) {
        record(errors, `${entryLabel} missing hooks array`);
        return;
      }

      entry.hooks.forEach((hook, hookIndex) => {
        const hookLabel = `${entryLabel}.hooks[${hookIndex}]`;
        if (!isPlainObject(hook)) {
          record(errors, `${hookLabel} must be an object`);
          return;
        }
        for (const key of Object.keys(hook)) {
          if (!HOOK_KEYS.has(key)) {
            record(errors, `${hookLabel} contains unsupported field "${key}"`);
          }
        }
        if (hook.type !== 'command') {
          record(errors, `${hookLabel} type must be "command"`);
        }
        if (typeof hook.command !== 'string' || hook.command.trim() === '') {
          record(errors, `${hookLabel} missing command string`);
          return;
        }
        if (/\.sh/.test(hook.command) && !/^bash\s+"/.test(hook.command)) {
          record(errors, `${hookLabel} invokes a .sh script without explicit bash`);
        }

        const scriptPath = referencedHookScript(hook.command);
        if (!scriptPath) {
          record(errors, `${hookLabel} command must reference a .sh script under CLAUDE_PLUGIN_ROOT`);
        } else if (pluginRootDir) {
          const rootAbs = resolve(pluginRootDir);
          const abs = resolve(rootAbs, scriptPath);
          const rel = relative(rootAbs, abs);
          if (isAbsolute(scriptPath) || rel.startsWith('..') || isAbsolute(rel) || !existsSync(abs)) {
            record(errors, `${hookLabel} referenced script does not exist: ${scriptPath}`);
          }
        }

        if (hook.timeout !== undefined && (!Number.isInteger(hook.timeout) || hook.timeout <= 0)) {
          record(errors, `${hookLabel} timeout must be a positive integer`);
        }
        if (hook.async !== undefined && typeof hook.async !== 'boolean') {
          record(errors, `${hookLabel} async must be a boolean`);
        }
        if (hook.statusMessage !== undefined && typeof hook.statusMessage !== 'string') {
          record(errors, `${hookLabel} statusMessage must be a string`);
        }
      });
    });
  }

  return errors;
}

export function validateHooksJsonText(source, options = {}) {
  try {
    return validateHooksConfig(JSON.parse(source), options);
  } catch (error) {
    return [`  - hooks.json is not valid JSON: ${error.message}`];
  }
}

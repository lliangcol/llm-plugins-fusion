import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const SUPPORTED_EVENTS = new Set([
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionDenied',
  'ConfigChange',
  'SessionEnd',
]);

const ENTRY_KEYS = new Set([
  'matcher',
  'hooks',
]);

const HOOK_KEYS = new Set([
  'type',
  'command',
  'args',
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

function referencedHookScript(hook) {
  const candidates = [hook.command, ...(Array.isArray(hook.args) ? hook.args : [])];
  const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.includes('${CLAUDE_PLUGIN_ROOT}/'));
  const match = value?.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"\s]+\.(?:mjs|sh))/);
  return match?.[1] ?? null;
}

const REQUIRED_NOVA_EVENTS = new Map([
  ['PreToolUse', [
    { matcher: 'Write|Edit|NotebookEdit', script: 'hooks/scripts/pre-write-check.sh', command: 'bash', argsPrefix: ['-p'], async: false },
    { matcher: 'Bash', script: 'hooks/scripts/pre-bash-check.sh', command: 'bash', argsPrefix: ['-p'], async: false },
  ]],
  ['PostToolUse', [
    { matcher: 'Write|Edit', script: 'hooks/scripts/trusted-node-hook.sh', hookId: 'post-write-verify', command: 'bash', argsPrefix: ['-p'], async: false },
    { matcher: 'Write|Edit|NotebookEdit|Bash', script: 'hooks/scripts/trusted-node-hook.sh', hookId: 'post-audit-log', command: 'bash', argsPrefix: ['-p'], async: true },
  ]],
  ['PostToolUseFailure', [
    { matcher: 'Write|Edit|NotebookEdit|Bash', script: 'hooks/scripts/trusted-node-hook.sh', hookId: 'post-audit-log', command: 'bash', argsPrefix: ['-p'], async: true },
  ]],
  ['PermissionDenied', [
    { matcher: 'Write|Edit|NotebookEdit|Bash', script: 'hooks/scripts/trusted-node-hook.sh', hookId: 'post-audit-log', command: 'bash', argsPrefix: ['-p'], async: true },
  ]],
  ['ConfigChange', [
    { matcher: 'project_settings|local_settings', script: 'hooks/scripts/trusted-node-hook.sh', hookId: 'config-change-guard', command: 'bash', argsPrefix: ['-p'], async: false },
  ]],
  ['SessionEnd', [
    { matcher: '*', script: 'hooks/scripts/trusted-node-hook.sh', hookId: 'audit-compactor', command: 'bash', argsPrefix: ['-p'], async: false },
  ]],
]);

export function validateUpstreamHooksConfig(config, options = {}) {
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
        if (hook.args !== undefined && (!Array.isArray(hook.args) || hook.args.some((arg) => typeof arg !== 'string'))) {
          record(errors, `${hookLabel} args must be an array of strings`);
        }
        if (/\.sh/.test(hook.command) && !/^bash\s+"/.test(hook.command)) {
          record(errors, `${hookLabel} invokes a .sh script without explicit bash`);
        }

        const scriptPath = referencedHookScript(hook);
        if (!scriptPath) {
          record(errors, `${hookLabel} command or args must reference a script under CLAUDE_PLUGIN_ROOT`);
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

export function validateNovaHooksPolicy(config) {
  const errors = [];
  for (const [event, expectedEntries] of REQUIRED_NOVA_EVENTS) {
    const entries = config?.hooks?.[event];
    if (!Array.isArray(entries) || entries.length !== expectedEntries.length) {
      record(errors, `${event} must contain exactly ${expectedEntries.length} required hook entries`);
      continue;
    }
    expectedEntries.forEach((expected, index) => {
      const entry = entries[index];
      if (entry?.matcher !== expected.matcher) record(errors, `${event}[${index}] must use matcher ${expected.matcher}`);
      const hooks = entry?.hooks;
      if (!Array.isArray(hooks) || hooks.length !== 1) {
        record(errors, `${event}[${index}] must contain exactly one hook`);
        return;
      }
      const hook = hooks[0];
      if (hook.command !== expected.command) record(errors, `${event}[${index}] must use the required command form`);
      const expectedArgs = [
        ...(expected.argsPrefix ?? []),
        `\${CLAUDE_PLUGIN_ROOT}/${expected.script}`,
        ...(expected.hookId ? [expected.hookId] : []),
      ];
      if (!Array.isArray(hook.args) || JSON.stringify(hook.args) !== JSON.stringify(expectedArgs)) {
        record(errors, `${event}[${index}] must pass the required ${expected.command} arguments: ${expectedArgs.join(' ')}`);
      }
      if ((hook.async === true) !== expected.async) {
        record(errors, `${event}[${index}] async behavior differs from policy`);
      }
    });
  }
  return errors;
}

export function validateHooksConfig(config, options = {}) {
  return [
    ...validateUpstreamHooksConfig(config, options),
    ...validateNovaHooksPolicy(config),
  ];
}

export function validateHooksJsonText(source, options = {}) {
  try {
    return validateHooksConfig(JSON.parse(source), options);
  } catch (error) {
    return [`  - hooks.json is not valid JSON: ${error.message}`];
  }
}

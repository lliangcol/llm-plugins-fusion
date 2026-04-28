#!/usr/bin/env node
/**
 * Validate Claude Code hook configuration shape and referenced scripts.
 *
 * This check is intentionally dependency-free and cross-platform. Shell syntax
 * checks should still run with `bash -n` in Bash-capable environments.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const hooksPath = resolve(root, 'nova-plugin/hooks/hooks.json');

const errors = [];

function record(msg) {
  errors.push(`  ✗ ${msg}`);
}

let config;
try {
  config = JSON.parse(readFileSync(hooksPath, 'utf8'));
} catch (err) {
  record(`hooks.json is not valid JSON: ${err.message}`);
}

if (config) {
  const hooks = config.hooks;
  if (!hooks || typeof hooks !== 'object' || Array.isArray(hooks)) {
    record('missing hooks object');
  } else {
    for (const [event, entries] of Object.entries(hooks)) {
      if (!Array.isArray(entries)) {
        record(`${event} must be an array`);
        continue;
      }
      entries.forEach((entry, index) => {
        if (!entry.matcher || typeof entry.matcher !== 'string') {
          record(`${event}[${index}] missing matcher string`);
        }
        if (!Array.isArray(entry.hooks)) {
          record(`${event}[${index}] missing hooks array`);
          return;
        }
        entry.hooks.forEach((hook, hookIndex) => {
          const label = `${event}[${index}].hooks[${hookIndex}]`;
          if (hook.type !== 'command') {
            record(`${label} type must be "command"`);
          }
          if (!hook.command || typeof hook.command !== 'string') {
            record(`${label} missing command string`);
            return;
          }
          const command = hook.command;
          const scriptMatch = command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+\.sh)/);
          if (!scriptMatch) {
            record(`${label} command must reference a .sh script under CLAUDE_PLUGIN_ROOT`);
          } else {
            const scriptPath = resolve(root, 'nova-plugin', scriptMatch[1]);
            if (!existsSync(scriptPath)) {
              record(`${label} referenced script does not exist: nova-plugin/${scriptMatch[1]}`);
            }
          }
          if (/\.sh/.test(command) && !/^bash\s+"/.test(command)) {
            record(`${label} invokes a .sh script without explicit bash`);
          }
          if (hook.timeout !== undefined && (!Number.isInteger(hook.timeout) || hook.timeout <= 0)) {
            record(`${label} timeout must be a positive integer`);
          }
        });
      });
    }
  }
}

if (errors.length) {
  console.error(`Hook validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log('✓ hook validation passed');


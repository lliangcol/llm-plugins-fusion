#!/usr/bin/env node
/**
 * Validate hooks.json content passed on stdin.
 *
 * This script is distributed with the hook scripts so pre-write checks can
 * validate structure before a malformed hooks.json is written.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateHooksJsonText } from './hooks-schema.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || resolve(__dir, '../..');
const source = readFileSync(0, 'utf8');
const errors = validateHooksJsonText(source, { pluginRootDir: pluginRoot });

if (errors.length) {
  console.error(`Hook validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(error);
  process.exit(1);
}

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
import { validateHooksConfig } from '../nova-plugin/hooks/scripts/hooks-schema.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const hooksPath = resolve(root, 'nova-plugin/hooks/hooks.json');
const compatibilityHelpers = [
  'nova-plugin/hooks/scripts/pre-write-check.mjs',
  'nova-plugin/hooks/scripts/post-audit-log.mjs',
];

const errors = [];

try {
  const config = JSON.parse(readFileSync(hooksPath, 'utf8'));
  errors.push(...validateHooksConfig(config, {
    pluginRootDir: resolve(root, 'nova-plugin'),
  }));
} catch (error) {
  errors.push(`  - hooks.json is not valid JSON: ${error.message}`);
}

for (const helper of compatibilityHelpers) {
  if (!existsSync(resolve(root, helper))) {
    errors.push(`  - missing hook compatibility helper: ${helper}`);
  }
}

if (errors.length) {
  console.error(`Hook validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log('✓ hook validation passed');

#!/usr/bin/env node
/** PostToolUse verification for actual Write/Edit filesystem state. */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  configuredArtifactRoots,
  isProtectedHooksPath,
  resolveWorkspaceTarget,
} from '../../runtime/safe-workspace-path.mjs';
import { validateHooksJsonText } from './hooks-schema.mjs';

const pluginRoot = resolve(process.env.CLAUDE_PLUGIN_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), '..', '..'));
const MAX_VERIFIED_BYTES = 10 * 1024 * 1024;

function fail(message, details = []) {
  console.error(`[nova-plugin] POST_WRITE_VERIFICATION_FAILED: ${message}`);
  for (const detail of details) console.error(`  ${detail}`);
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  fail('PostToolUse payload is not valid JSON.');
}

if (!['Write', 'Edit'].includes(payload?.tool_name)) process.exit(0);
const input = payload.tool_input ?? {};
const projectRoot = resolve(process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd());
const effectiveCwd = resolve(payload.cwd || projectRoot);
const lexicalTarget = resolve(effectiveCwd, input.file_path ?? '');
const protectedTarget = isProtectedHooksPath(lexicalTarget, { projectRoot, pluginRoot });
let policy;
try {
  policy = resolveWorkspaceTarget({
    filePath: input.file_path,
    projectRoot,
    cwd: effectiveCwd,
    artifactRoots: configuredArtifactRoots(),
    mustExist: true,
    protectedTarget,
  });
} catch (error) {
  fail('Actual write target violates workspace containment.', [
    `Target: ${input.file_path ?? '<missing>'}`,
    `Reason: ${error.message}`,
  ]);
}

if (protectedTarget) {
  const content = readFileSync(policy.target);
  if (content.length > MAX_VERIFIED_BYTES) fail('Protected configuration exceeds verification size limit.');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    fail('Protected configuration is not valid UTF-8.');
  }
  const errors = validateHooksJsonText(text, { pluginRootDir: pluginRoot });
  if (errors.length) fail('Protected hooks configuration is invalid after the write.', errors);
}

#!/usr/bin/env node
/** PostToolUse verification for actual Write/Edit filesystem state. */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertArtifactRootsOutsideExecutableSearch,
  configuredArtifactRoots,
  isProtectedHooksPath,
  isProtectedShellControlPath,
  resolveWorkspaceTarget,
} from '../../runtime/safe-workspace-path.mjs';
import { inspectProjectHookSettings } from '../../runtime/hook-bootstrap-trust.mjs';
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
const projectSettingsTrust = inspectProjectHookSettings(projectRoot);
if (!projectSettingsTrust.trusted) {
  fail('Project settings changed the hook trust boundary before startup.', projectSettingsTrust.findings);
}
let artifactRoots;
try {
  artifactRoots = configuredArtifactRoots();
  assertArtifactRootsOutsideExecutableSearch({ artifactRoots, cwd: effectiveCwd, projectRoot });
} catch (error) {
  fail('Explicit artifact root conflicts with the hook executable trust boundary.', [`Reason: ${error.message}`]);
}
const lexicalTarget = resolve(effectiveCwd, input.file_path ?? '');
const protectedTarget = isProtectedHooksPath(lexicalTarget, { projectRoot, pluginRoot });
if (isProtectedShellControlPath(lexicalTarget, { projectRoot, pluginRoot, artifactRoots })) {
  fail('Agent control path was modified during an agent session.', [`Target: ${input.file_path ?? '<missing>'}`]);
}
let policy;
try {
  policy = resolveWorkspaceTarget({
    filePath: input.file_path,
    projectRoot,
    cwd: effectiveCwd,
    artifactRoots,
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

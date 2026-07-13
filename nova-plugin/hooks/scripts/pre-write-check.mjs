#!/usr/bin/env node
/** Fail-closed PreToolUse write guard for Write, Edit, and unsupported NotebookEdit. */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSensitiveText, newSensitiveFindings } from '../../runtime/secret-rules.mjs';
import {
  configuredArtifactRoots,
  isProtectedHooksPath,
  isProtectedShellControlPath,
  resolveWorkspaceTarget,
} from '../../runtime/safe-workspace-path.mjs';
import { validateHooksJsonText } from './hooks-schema.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(process.env.CLAUDE_PLUGIN_ROOT || resolve(__dir, '..', '..'));
const MAX_GUARDED_TEXT_BYTES = 10 * 1024 * 1024;

function block(message, details = []) {
  console.error(`[nova-plugin] ${message}`);
  for (const detail of details) console.error(`  ${detail}`);
  process.exit(2);
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parsePayload() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    block('hook payload 不是有效 JSON，写入已阻止。');
  }
  if (!plainObject(payload) || !plainObject(payload.tool_input)) {
    block('hook payload 缺少 tool_input，写入已阻止。');
  }
  if (!['Write', 'Edit', 'NotebookEdit'].includes(payload.tool_name)) {
    block(`不支持的写入工具 ${JSON.stringify(payload.tool_name)}，写入已阻止。`);
  }
  if (payload.tool_name === 'NotebookEdit') {
    if (typeof payload.tool_input.notebook_path !== 'string' || payload.tool_input.notebook_path.trim() === '') {
      block('NotebookEdit payload 缺少 notebook_path，写入已阻止。');
    }
    block('NotebookEdit 无法可靠重构完整 proposed content，写入已阻止。', [
      `目标: ${payload.tool_input.notebook_path}`,
      '建议: 当前 nova workflows 禁止 NotebookEdit；请改用受保护的 Write/Edit 流程。',
    ]);
  }
  if (typeof payload.tool_input.file_path !== 'string' || payload.tool_input.file_path.trim() === '') {
    block('hook payload 缺少 file_path，写入已阻止。');
  }
  return payload;
}

function countOccurrences(source, target) {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = source.indexOf(target, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + target.length;
  }
}

function readGuardedText(target, displayPath) {
  let data;
  try {
    data = readFileSync(target);
  } catch {
    block('Edit 目标无法读取。', [`目标: ${displayPath}`]);
  }
  if (data.length > MAX_GUARDED_TEXT_BYTES) {
    block('Edit 目标超过安全扫描大小上限。', [`目标: ${displayPath}`]);
  }
  if (data.subarray(0, Math.min(data.length, 8192)).includes(0)) {
    block('Edit 目标疑似二进制文件，无法可靠扫描。', [`目标: ${displayPath}`]);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data);
  } catch {
    block('Edit 目标不是有效 UTF-8 文本。', [`目标: ${displayPath}`]);
  }
}

function proposedEditContent(input, target) {
  if (typeof input.old_string !== 'string' || input.old_string.length === 0) {
    block('Edit payload 的 old_string 必须是非空字符串。');
  }
  if (typeof input.new_string !== 'string') {
    block('Edit payload 的 new_string 必须是字符串。');
  }

  const current = readGuardedText(target, input.file_path);
  const occurrences = countOccurrences(current, input.old_string);
  if (occurrences === 0) {
    block('Edit old_string 未在目标文件中命中。', [`目标: ${input.file_path}`]);
  }
  if (input.replace_all !== true && occurrences !== 1) {
    block('Edit old_string 命中不唯一；请扩大上下文或显式使用 replace_all。', [`命中数: ${occurrences}`]);
  }
  const proposed = input.replace_all === true
    ? current.split(input.old_string).join(input.new_string)
    : current.replace(input.old_string, input.new_string);
  return { current, proposed };
}

const major = Number.parseInt(process.versions.node.split('.')[0], 10);
if (!Number.isInteger(major) || major < 22) {
  block(`Node.js 22+ is required by the write guard; found ${process.version}.`);
}

const payload = parsePayload();
const input = payload.tool_input;
const projectRoot = resolve(process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd());
const effectiveCwd = resolve(payload.cwd || projectRoot);
const lexicalTarget = resolve(effectiveCwd, input.file_path);
const protectedTarget = isProtectedHooksPath(lexicalTarget, { projectRoot, pluginRoot });
const protectedShellControl = isProtectedShellControlPath(lexicalTarget, { projectRoot, pluginRoot });
if (protectedShellControl) {
  block('shell policy control path cannot be modified during an agent session.', [`目标: ${input.file_path}`]);
}
let pathPolicy;
try {
  pathPolicy = resolveWorkspaceTarget({
    filePath: input.file_path,
    projectRoot,
    cwd: effectiveCwd,
    artifactRoots: configuredArtifactRoots(),
    mustExist: payload.tool_name === 'Edit',
    protectedTarget,
  });
} catch (error) {
  block('写入目标不满足 workspace 路径安全策略。', [
    `目标: ${input.file_path}`,
    `原因: ${error.message}`,
  ]);
}
let proposedContent;
let beforeFindings = [];

if (payload.tool_name === 'Write') {
  if (typeof input.content !== 'string') block('Write payload 的 content 必须是字符串。');
  if (Buffer.byteLength(input.content, 'utf8') > MAX_GUARDED_TEXT_BYTES) {
    block('Write 内容超过安全扫描大小上限。', [`目标: ${input.file_path}`]);
  }
  proposedContent = input.content;
} else {
  const edit = proposedEditContent(input, pathPolicy.target);
  proposedContent = edit.proposed;
  beforeFindings = findSensitiveText(edit.current);
}

const afterFindings = findSensitiveText(proposedContent);
const introducedFindings = payload.tool_name === 'Write'
  ? afterFindings
  : newSensitiveFindings(beforeFindings, afterFindings);
if (introducedFindings.length > 0) {
  block('疑似硬编码敏感信息，请使用环境变量替代。', [
    `匹配文件: ${input.file_path}`,
    `规则: ${[...new Set(introducedFindings.map((finding) => finding.ruleId))].join(', ')}`,
    '建议: 使用环境变量、占位符或私有 consumer profile，不要写入公开仓库内容。',
  ]);
}

if (protectedTarget) {
  const errors = validateHooksJsonText(proposedContent, { pluginRootDir: pluginRoot });
  if (errors.length > 0) {
    block('hooks.json 结构无效，写入已阻止。', [
      ...errors.map((error) => error.trim()),
      '建议: 参考 nova-plugin/hooks/hooks.json，并运行 node scripts/validate-hooks.mjs。',
    ]);
  }
}

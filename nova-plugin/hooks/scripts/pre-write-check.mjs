#!/usr/bin/env node
/** Fail-closed PreToolUse write guard for Write, Edit, and unsupported NotebookEdit. */

import { lstatSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasSensitiveText } from '../../runtime/secret-rules.mjs';
import { validateHooksJsonText } from './hooks-schema.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(process.env.CLAUDE_PLUGIN_ROOT || resolve(__dir, '..', '..'));

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

function proposedEditContent(input) {
  if (typeof input.old_string !== 'string' || input.old_string.length === 0) {
    block('Edit payload 的 old_string 必须是非空字符串。');
  }
  if (typeof input.new_string !== 'string') {
    block('Edit payload 的 new_string 必须是字符串。');
  }

  const target = resolve(input.file_path);
  let stat;
  try {
    stat = lstatSync(target);
  } catch {
    block('Edit 目标文件不存在或不可读取。', [`目标: ${input.file_path}`]);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    block('Edit 目标必须是普通文件且不能是符号链接。', [`目标: ${input.file_path}`]);
  }

  let current;
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    block('Edit 目标无法按 UTF-8 读取。', [`目标: ${input.file_path}`]);
  }
  const occurrences = countOccurrences(current, input.old_string);
  if (occurrences === 0) {
    block('Edit old_string 未在目标文件中命中。', [`目标: ${input.file_path}`]);
  }
  if (input.replace_all !== true && occurrences !== 1) {
    block('Edit old_string 命中不唯一；请扩大上下文或显式使用 replace_all。', [`命中数: ${occurrences}`]);
  }
  return input.replace_all === true
    ? current.split(input.old_string).join(input.new_string)
    : current.replace(input.old_string, input.new_string);
}

function validateWriteTarget(input) {
  const target = resolve(input.file_path);
  let stat;
  try {
    stat = lstatSync(target);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    block('Write 目标无法可靠检查。', [`目标: ${input.file_path}`]);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    block('已存在的 Write 目标必须是普通文件且不能是符号链接。', [`目标: ${input.file_path}`]);
  }
}

function isHooksJson(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  return normalized === 'hooks.json' || normalized.endsWith('/hooks.json');
}

const major = Number.parseInt(process.versions.node.split('.')[0], 10);
if (!Number.isInteger(major) || major < 20) {
  block(`Node.js 20+ is required by the write guard; found ${process.version}.`);
}

const payload = parsePayload();
const input = payload.tool_input;
let proposedContent;
let insertedContent;

if (payload.tool_name === 'Write') {
  if (typeof input.content !== 'string') block('Write payload 的 content 必须是字符串。');
  validateWriteTarget(input);
  proposedContent = input.content;
  insertedContent = input.content;
} else {
  proposedContent = proposedEditContent(input);
  insertedContent = input.new_string;
}

if (insertedContent && hasSensitiveText(insertedContent)) {
  block('疑似硬编码敏感信息，请使用环境变量替代。', [
    `匹配文件: ${input.file_path}`,
    '建议: 使用环境变量、占位符或私有 consumer profile，不要写入公开仓库内容。',
  ]);
}

if (isHooksJson(input.file_path)) {
  const errors = validateHooksJsonText(proposedContent, { pluginRootDir: pluginRoot });
  if (errors.length > 0) {
    block('hooks.json 结构无效，写入已阻止。', [
      ...errors.map((error) => error.trim()),
      '建议: 参考 nova-plugin/hooks/hooks.json，并运行 node scripts/validate-hooks.mjs。',
    ]);
  }
}

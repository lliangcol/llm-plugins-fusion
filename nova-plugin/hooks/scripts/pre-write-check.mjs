#!/usr/bin/env node
/**
 * Node compatibility helper for the PreToolUse write guard.
 *
 * hooks.json still uses the Bash entry point. This helper mirrors the behavior
 * so maintainers can validate a future Node-active hook path without requiring
 * jq or Bash for the payload parsing itself.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasSensitiveText } from '../../runtime/secret-rules.mjs';
import { validateHooksJsonText } from './hooks-schema.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(process.env.CLAUDE_PLUGIN_ROOT || resolve(__dir, '..', '..'));

function readStdin() {
  return readFileSync(0, 'utf8');
}

function parsePayload(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

function collectContent(input) {
  const parts = [];
  if (input.content != null) parts.push(input.content);
  if (input.new_string != null) parts.push(input.new_string);
  if (Array.isArray(input.edits)) {
    for (const edit of input.edits) {
      if (edit?.new_string != null) parts.push(edit.new_string);
    }
  }
  return parts.join('\n');
}

const payload = parsePayload(readStdin());
const input = payload.tool_input || {};
const filePath = input.file_path || '';
const content = collectContent(input);

if (content && hasSensitiveText(content)) {
  console.error('[nova-plugin] 疑似硬编码敏感信息，请使用环境变量替代。');
  console.error(`  匹配文件: ${filePath || 'unknown'}`);
  console.error('  建议: 使用环境变量、占位符或私有 consumer profile，不要写入公开仓库内容。');
  process.exit(2);
}

if (content && filePath.endsWith('hooks.json')) {
  try {
    JSON.parse(content);
  } catch {
    console.error('[nova-plugin] hooks.json JSON 格式无效，写入已阻止。');
    console.error('  建议: 修复 JSON 语法后运行 node scripts/validate-hooks.mjs。');
    process.exit(2);
  }

  const errors = validateHooksJsonText(content, { pluginRootDir: pluginRoot });
  if (errors.length > 0) {
    console.error('[nova-plugin] hooks.json 结构无效，写入已阻止。');
    for (const error of errors) console.error(error);
    console.error('  建议: 参考 nova-plugin/hooks/hooks.json，并运行 node scripts/validate-hooks.mjs。');
    process.exit(2);
  }
}

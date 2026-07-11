#!/usr/bin/env bash
# PreToolUse hook: Write / Edit / MultiEdit
# 在文件写入前执行检查：
#   1. 敏感信息硬编码检测
#   2. hooks.json JSON 格式校验
#
# 退出码规则：
#   0  → 允许操作（可附带 stdout 警告文本）
#   2  → 阻断操作（stderr 作为错误反馈）

set -euo pipefail

INPUT=$(cat)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd -- "$SCRIPT_DIR/../.." >/dev/null 2>&1 && pwd -P)}"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../../runtime/bash-common.sh
source "$PLUGIN_ROOT/runtime/bash-common.sh"

json_read() {
  local field="$1"
  local jq_expr
  local node_bin=""

  case "$field" in
    file_path) jq_expr='.tool_input.file_path // ""' ;;
    content) jq_expr='[.tool_input.content?, .tool_input.new_string?, (.tool_input.edits[]?.new_string?)] | map(select(. != null)) | join("\n")' ;;
    *) jq_expr='""' ;;
  esac

  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r "$jq_expr" 2>/dev/null || true
    return 0
  fi

  if node_bin="$(nova_node_command)"; then
    printf '%s' "$INPUT" | "$node_bin" -e '
const fs = require("fs");
const field = process.argv[1];
let data = {};
try {
  data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}
const input = data.tool_input || {};
let value = "";
if (field === "file_path") {
  value = input.file_path || "";
} else if (field === "content") {
  const parts = [];
  if (input.content != null) parts.push(input.content);
  if (input.new_string != null) parts.push(input.new_string);
  if (Array.isArray(input.edits)) {
    for (const edit of input.edits) {
      if (edit && edit.new_string != null) parts.push(edit.new_string);
    }
  }
  value = parts.join("\n");
}
process.stdout.write(value == null ? "" : String(value));
' "$field" 2>/dev/null || true
    return 0
  fi

  return 0
}

json_valid() {
  local node_bin=""

  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$1" | jq empty >/dev/null 2>&1
    return
  fi

  if node_bin="$(nova_node_command)"; then
    printf '%s' "$1" | "$node_bin" -e '
const fs = require("fs");
try {
  JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(1);
}
' >/dev/null 2>&1
    return
  fi

  return 1
}

json_has_hooks() {
  local node_bin=""

  if command -v jq >/dev/null 2>&1; then
    [ "$(printf '%s' "$1" | jq 'has("hooks")' 2>/dev/null || echo "false")" = "true" ]
    return
  fi

  if node_bin="$(nova_node_command)"; then
    printf '%s' "$1" | "$node_bin" -e '
const fs = require("fs");
try {
  const data = JSON.parse(fs.readFileSync(0, "utf8"));
  process.exit(Object.prototype.hasOwnProperty.call(data, "hooks") ? 0 : 1);
} catch {
  process.exit(1);
}
' >/dev/null 2>&1
    return
  fi

  return 1
}

validate_hooks_json_schema() {
  local content="$1"
  local node_bin=""
  local node_plugin_root=""
  local node_validator_path=""

  if node_bin="$(nova_node_command)" && [ -f "$PLUGIN_ROOT/hooks/scripts/validate-hooks-json.mjs" ]; then
    node_plugin_root="$(nova_path_for_node_command "$PLUGIN_ROOT" "$node_bin")"
    node_validator_path="$(nova_path_for_node_command "$PLUGIN_ROOT/hooks/scripts/validate-hooks-json.mjs" "$node_bin")"
    printf '%s' "$content" | CLAUDE_PLUGIN_ROOT="$node_plugin_root" "$node_bin" "$node_validator_path"
    return
  fi

  json_has_hooks "$content"
}

FILE_PATH=$(json_read file_path)
CONTENT=$(json_read content)

content_has_sensitive_value() {
  local content="$1"
  local node_bin=""
  local rules_path=""
  local node_rules_path=""

  node_bin="$(nova_node_command)" || return 1
  rules_path="$(nova_secret_rules_path)"
  [ -f "$rules_path" ] || return 1
  node_rules_path="$(nova_secret_rules_path_for_node "$node_bin")"
  printf '%s' "$content" | "$node_bin" "$node_rules_path" detect-text
}

# ── 检查 1：敏感信息硬编码检测 ────────────────────────────────────
if [ -n "$CONTENT" ] && content_has_sensitive_value "$CONTENT"; then
  echo "[nova-plugin] 疑似硬编码敏感信息，请使用环境变量替代。" >&2
  echo "  匹配文件: ${FILE_PATH:-unknown}" >&2
  echo "  建议: 使用环境变量、占位符或私有 consumer profile，不要写入公开仓库内容。" >&2
  exit 2
fi

# ── 检查 2：hooks.json JSON 格式校验 ─────────────────────────────
if [[ -n "$CONTENT" && "$FILE_PATH" == *hooks.json ]]; then
  if ! json_valid "$CONTENT"; then
    echo "[nova-plugin] hooks.json JSON 格式无效，写入已阻止。" >&2
    echo "  建议: 修复 JSON 语法后运行 node scripts/validate-hooks.mjs。" >&2
    exit 2
  fi
  if ! HOOKS_SCHEMA_OUTPUT=$(validate_hooks_json_schema "$CONTENT" 2>&1); then
    echo "[nova-plugin] hooks.json 结构无效，写入已阻止。" >&2
    if [ -n "$HOOKS_SCHEMA_OUTPUT" ]; then
      printf '%s\n' "$HOOKS_SCHEMA_OUTPUT" | sed 's/^/  /' >&2
    fi
    echo "  建议: 参考 nova-plugin/hooks/hooks.json，并运行 node scripts/validate-hooks.mjs。" >&2
    exit 2
  fi
fi

exit 0

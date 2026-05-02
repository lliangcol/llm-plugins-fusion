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

json_read() {
  local field="$1"
  local jq_expr

  case "$field" in
    file_path) jq_expr='.tool_input.file_path // ""' ;;
    content) jq_expr='[.tool_input.content?, .tool_input.new_string?, (.tool_input.edits[]?.new_string?)] | map(select(. != null)) | join("\n")' ;;
    *) jq_expr='""' ;;
  esac

  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$INPUT" | jq -r "$jq_expr" 2>/dev/null || true
    return 0
  fi

  if command -v node >/dev/null 2>&1; then
    printf '%s' "$INPUT" | node -e '
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
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$1" | jq empty >/dev/null 2>&1
    return
  fi

  if command -v node >/dev/null 2>&1; then
    printf '%s' "$1" | node -e '
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
  if command -v jq >/dev/null 2>&1; then
    [ "$(printf '%s' "$1" | jq 'has("hooks")' 2>/dev/null || echo "false")" = "true" ]
    return
  fi

  if command -v node >/dev/null 2>&1; then
    printf '%s' "$1" | node -e '
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

FILE_PATH=$(json_read file_path)
CONTENT=$(json_read content)

# ── 检查 1：敏感信息硬编码检测 ────────────────────────────────────
# 匹配 password=, secret=, api_key= 等赋值模式（不区分大小写）
SENSITIVE_PATTERN="(password|secret|api_key|access_token|private_key)[[:space:]]*[:=][[:space:]]*[\"'][^\"']{6,}"

if [ -n "$CONTENT" ] && echo "$CONTENT" | grep -Eiq "$SENSITIVE_PATTERN"; then
  echo "[nova-plugin] 疑似硬编码敏感信息，请使用环境变量替代。" >&2
  echo "  匹配文件: $FILE_PATH" >&2
  exit 2
fi

# ── 检查 2：hooks.json JSON 格式校验 ─────────────────────────────
if echo "$FILE_PATH" | grep -q 'hooks\.json$' && [ -n "$CONTENT" ]; then
  if ! json_valid "$CONTENT"; then
    echo "[nova-plugin] hooks.json JSON 格式无效，写入已阻止。" >&2
    exit 2
  fi
  # 检查是否包含顶层 "hooks" 字段
  if ! json_has_hooks "$CONTENT"; then
    echo "[nova-plugin] hooks.json 缺少顶层 \"hooks\" 字段。" >&2
    exit 2
  fi
fi

exit 0

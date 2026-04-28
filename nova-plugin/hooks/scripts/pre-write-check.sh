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

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // .tool_input.new_string // ""')

# ── 检查 1：敏感信息硬编码检测 ────────────────────────────────────
# 匹配 password=, secret=, api_key= 等赋值模式（不区分大小写）
SENSITIVE_PATTERN='(password|secret|api_key|access_token|private_key)\s*[=:]\s*["\x27][^"\x27]{6,}'

if [ -n "$CONTENT" ] && echo "$CONTENT" | grep -Eiq "$SENSITIVE_PATTERN"; then
  echo "[nova-plugin] 疑似硬编码敏感信息，请使用环境变量替代。" >&2
  echo "  匹配文件: $FILE_PATH" >&2
  exit 2
fi

# ── 检查 2：hooks.json JSON 格式校验 ─────────────────────────────
if echo "$FILE_PATH" | grep -q 'hooks\.json$' && [ -n "$CONTENT" ]; then
  if ! echo "$CONTENT" | jq empty 2>/dev/null; then
    echo "[nova-plugin] hooks.json JSON 格式无效，写入已阻止。" >&2
    exit 2
  fi
  # 检查是否包含顶层 "hooks" 字段
  HAS_HOOKS=$(echo "$CONTENT" | jq 'has("hooks")' 2>/dev/null || echo "false")
  if [ "$HAS_HOOKS" != "true" ]; then
    echo "[nova-plugin] hooks.json 缺少顶层 \"hooks\" 字段。" >&2
    exit 2
  fi
fi

exit 0

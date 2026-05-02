#!/usr/bin/env bash
# PostToolUse hook: Write / Edit / Bash / MultiEdit
# 记录工具操作审计日志至 ${CLAUDE_PLUGIN_DATA}/audit.log
#
# 日志格式：
#   [ISO时间戳] TOOL_NAME  摘要  STATUS
#
# 注：PostToolUse hook 不会阻断已完成的操作，此脚本仅用于记录。

set -euo pipefail

INPUT=$(cat)

json_read() {
  local field="$1"
  local jq_expr

  case "$field" in
    tool_name) jq_expr='.tool_name // "unknown"' ;;
    file_path) jq_expr='.tool_input.file_path // .tool_response.filePath // ""' ;;
    command) jq_expr='.tool_input.command // ""' ;;
    success) jq_expr='.tool_response.success // true' ;;
    tool_input_keys) jq_expr='(.tool_input // {}) | keys | join(",")' ;;
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
const response = data.tool_response || {};
let value = "";
if (field === "tool_name") value = data.tool_name || "unknown";
else if (field === "file_path") value = input.file_path || response.filePath || "";
else if (field === "command") value = input.command || "";
else if (field === "success") value = response.success == null ? true : response.success;
else if (field === "tool_input_keys") value = Object.keys(input).join(",");
process.stdout.write(value == null ? "" : String(value));
' "$field" 2>/dev/null || true
    return 0
  fi

  return 0
}

TOOL_NAME=$(json_read tool_name)
TOOL_NAME=${TOOL_NAME:-unknown}
FILE_PATH=$(json_read file_path)
COMMAND=$(json_read command)
SUCCESS=$(json_read success)
SUCCESS=${SUCCESS:-true}
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 构造摘要（取文件路径或命令，截断到 80 字符）
if [ -n "$FILE_PATH" ]; then
  SUMMARY="$FILE_PATH"
elif [ -n "$COMMAND" ]; then
  # 命令截断到 60 字符
  SUMMARY="${COMMAND:0:60}"
  [ ${#COMMAND} -gt 60 ] && SUMMARY="${SUMMARY}..."
else
  SUMMARY=$(json_read tool_input_keys)
  SUMMARY=${SUMMARY:-N/A}
fi

STATUS="SUCCESS"
if [ "$SUCCESS" = "false" ]; then
  STATUS="FAILED"
fi

# 确定日志文件路径
# 优先使用 CLAUDE_PLUGIN_DATA，回退到系统临时目录
LOG_DIR="${CLAUDE_PLUGIN_DATA:-/tmp/nova-plugin}"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/audit.log"

# 追加日志（非阻塞，忽略写入失败）
printf "%-24s %-16s %-8s %s\n" "$TIMESTAMP" "$TOOL_NAME" "$STATUS" "$SUMMARY" >> "$LOG_FILE" 2>/dev/null || true

exit 0

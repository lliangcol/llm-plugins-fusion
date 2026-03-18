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

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
SUCCESS=$(echo "$INPUT" | jq -r '.tool_response.success // true')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 构造摘要（取文件路径或命令，截断到 80 字符）
if [ -n "$FILE_PATH" ]; then
  SUMMARY="$FILE_PATH"
elif [ -n "$COMMAND" ]; then
  # 命令截断到 60 字符
  SUMMARY="${COMMAND:0:60}"
  [ ${#COMMAND} -gt 60 ] && SUMMARY="${SUMMARY}..."
else
  SUMMARY=$(echo "$INPUT" | jq -r '.tool_input | keys | join(",")' 2>/dev/null || echo "N/A")
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

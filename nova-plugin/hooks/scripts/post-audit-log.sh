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

sanitize_audit_field() {
  local text="$1"
  local max_length="$2"
  local node_bin=""
  local rules_path=""
  local node_rules_path=""

  if node_bin="$(nova_node_command)" && rules_path="$(nova_secret_rules_path)" && [ -f "$rules_path" ]; then
    node_rules_path="$(nova_secret_rules_path_for_node "$node_bin")"
    printf '%s' "$text" | "$node_bin" "$node_rules_path" sanitize-audit-field "$max_length" 2>/dev/null || printf '<redaction-unavailable>'
    return 0
  fi

  printf '<redaction-unavailable>'
}

TOOL_NAME=$(json_read tool_name)
TOOL_NAME=${TOOL_NAME:-unknown}
TOOL_NAME=$(sanitize_audit_field "$TOOL_NAME" 32)
TOOL_NAME=${TOOL_NAME:-unknown}
FILE_PATH=$(json_read file_path)
COMMAND=$(json_read command)
SUCCESS=$(json_read success)
SUCCESS=${SUCCESS:-true}
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 构造摘要（取文件路径、命令或输入键，统一脱敏为单行并限制长度）
if [ -n "$FILE_PATH" ]; then
  SUMMARY="$FILE_PATH"
elif [ -n "$COMMAND" ]; then
  SUMMARY="$COMMAND"
else
  SUMMARY=$(json_read tool_input_keys)
  SUMMARY=${SUMMARY:-N/A}
fi
SUMMARY=$(sanitize_audit_field "$SUMMARY" 200)
SUMMARY=${SUMMARY:-N/A}

STATUS="SUCCESS"
if [ "$SUCCESS" = "false" ]; then
  STATUS="FAILED"
fi

# 确定日志文件路径
# 优先使用 CLAUDE_PLUGIN_DATA，回退到用户状态目录。
if [ "${NOVA_AUDIT_DISABLED:-0}" = "1" ]; then
  exit 0
fi

DEFAULT_STATE_HOME="${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}"
LOG_DIR="${CLAUDE_PLUGIN_DATA:-$DEFAULT_STATE_HOME/nova-plugin}"
mkdir -p "$LOG_DIR" 2>/dev/null || exit 0
chmod 700 "$LOG_DIR" 2>/dev/null || true
LOG_FILE="$LOG_DIR/audit.log"
touch "$LOG_FILE" 2>/dev/null || exit 0
chmod 600 "$LOG_FILE" 2>/dev/null || true

LOG_SIZE=$(wc -c < "$LOG_FILE" 2>/dev/null || printf '0')
if [ "${LOG_SIZE:-0}" -gt 5242880 ] 2>/dev/null; then
  if mv -f "$LOG_FILE" "$LOG_FILE.1" 2>/dev/null; then
    : > "$LOG_FILE" 2>/dev/null || true
    chmod 600 "$LOG_FILE" 2>/dev/null || true
  fi
fi

# 追加日志（非阻塞，忽略写入失败）
printf "%-24s %-16s %-8s %s\n" "$TIMESTAMP" "$TOOL_NAME" "$STATUS" "$SUMMARY" >> "$LOG_FILE" 2>/dev/null || true

exit 0

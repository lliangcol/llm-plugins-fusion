#!/usr/bin/env bash
# Thin launcher for the non-blocking Node PostToolUse audit logger.

set -euo pipefail

if [ "${NOVA_AUDIT_DISABLED:-0}" = "1" ]; then
  exit 0
fi

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_PARENT="."
case "$SCRIPT_PATH" in
  */*) SCRIPT_PARENT="${SCRIPT_PATH%/*}" ;;
esac
SCRIPT_DIR="$(cd -P -- "$SCRIPT_PARENT" >/dev/null 2>&1 && builtin pwd -P)"
PLUGIN_ROOT="$(cd -P -- "$SCRIPT_DIR/../.." >/dev/null 2>&1 && builtin pwd -P)"
export CLAUDE_PLUGIN_ROOT="$PLUGIN_ROOT"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../../runtime/bash-common.sh
source "$PLUGIN_ROOT/runtime/bash-common.sh"

PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(builtin pwd -P)}"
if ! NODE_BIN="$(nova_node_command "$PROJECT_ROOT")"; then
  echo "[nova-plugin] WARNING: audit logger skipped because Node.js 22+ is unavailable." >&2
  exit 0
fi

NODE_SCRIPT="$(nova_path_for_node_command "$PLUGIN_ROOT/hooks/scripts/post-audit-log.mjs" "$NODE_BIN")"
exec "$NODE_BIN" "$NODE_SCRIPT"

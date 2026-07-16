#!/usr/bin/env bash
# Thin fail-closed launcher for the Node PreToolUse Bash guard.

set -euo pipefail

if [ "${BASH_ENV+x}" = "x" ] || [ "${ENV+x}" = "x" ]; then
  echo "[nova-plugin] BASH_ENV/ENV inheritance is not allowed for guarded shell launchers; Bash blocked." >&2
  exit 2
fi

if [ "${NODE_OPTIONS+x}" = "x" ]; then
  echo "[nova-plugin] NODE_OPTIONS inheritance is not allowed before guarded Node startup; Bash blocked." >&2
  exit 2
fi

if [ "${NOVA_WRITE_GUARD_DISABLED:-0}" = "1" ]; then
  echo "[nova-plugin] NOVA_WRITE_GUARD_DISABLED=1 is not accepted by the fail-closed shell guard; Bash blocked." >&2
  exit 2
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
  echo "[nova-plugin] A trusted Node.js 22+ executable outside the project is required by the active shell guard; Bash blocked." >&2
  exit 2
fi

NODE_SCRIPT="$(nova_path_for_node_command "$PLUGIN_ROOT/hooks/scripts/pre-bash-check.mjs" "$NODE_BIN")"
exec "$NODE_BIN" "$NODE_SCRIPT"

#!/usr/bin/env bash
# Thin launcher for the non-blocking Node PostToolUse audit logger.

set -euo pipefail

if [ "${NOVA_AUDIT_DISABLED:-0}" = "1" ]; then
  exit 0
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd -- "$SCRIPT_DIR/../.." >/dev/null 2>&1 && pwd -P)}"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../../runtime/bash-common.sh
source "$PLUGIN_ROOT/runtime/bash-common.sh"

if ! NODE_BIN="$(nova_node_command)"; then
  echo "[nova-plugin] WARNING: audit logger skipped because Node.js 20+ is unavailable." >&2
  exit 0
fi

NODE_SCRIPT="$(nova_path_for_node_command "$PLUGIN_ROOT/hooks/scripts/post-audit-log.mjs" "$NODE_BIN")"
exec "$NODE_BIN" "$NODE_SCRIPT"

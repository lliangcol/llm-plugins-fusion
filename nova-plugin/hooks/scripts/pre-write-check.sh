#!/usr/bin/env bash
# Thin fail-closed launcher for the Node PreToolUse write guard.

set -euo pipefail

if [ "${NOVA_WRITE_GUARD_DISABLED:-0}" = "1" ]; then
  echo "[nova-plugin] WARNING: write guard explicitly disabled by NOVA_WRITE_GUARD_DISABLED=1; no permission decision was made." >&2
  exit 0
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd -P)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd -- "$SCRIPT_DIR/../.." >/dev/null 2>&1 && pwd -P)}"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=../../runtime/bash-common.sh
source "$PLUGIN_ROOT/runtime/bash-common.sh"

if ! NODE_BIN="$(nova_node_command)"; then
  echo "[nova-plugin] Node.js 22+ is required by the active write guard; write blocked." >&2
  echo "  Set NOVA_WRITE_GUARD_DISABLED=1 only for an explicit, temporary bypass." >&2
  exit 2
fi

NODE_SCRIPT="$(nova_path_for_node_command "$PLUGIN_ROOT/hooks/scripts/pre-write-check.mjs" "$NODE_BIN")"
exec "$NODE_BIN" "$NODE_SCRIPT"

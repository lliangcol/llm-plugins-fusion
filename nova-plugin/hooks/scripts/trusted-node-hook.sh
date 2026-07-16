#!/usr/bin/env bash
# Fail-closed launcher for active Node-owned post-use and session hooks.

set -euo pipefail

if [ "${BASH_ENV+x}" = "x" ] || [ "${ENV+x}" = "x" ]; then
  echo "[nova-plugin] BASH_ENV/ENV inheritance is not allowed for guarded hook launchers; hook blocked." >&2
  exit 2
fi

if [ "${NODE_OPTIONS+x}" = "x" ]; then
  echo "[nova-plugin] NODE_OPTIONS inheritance is not allowed before guarded Node startup; hook blocked." >&2
  exit 2
fi

if [ -n "$(compgen -A variable BASH_FUNC_ || true)" ]; then
  echo "[nova-plugin] Exported Bash functions are not allowed for guarded hook launchers; hook blocked." >&2
  exit 2
fi

if [ "$#" -ne 1 ]; then
  echo "[nova-plugin] Guarded Node hook launcher requires exactly one known hook id; hook blocked." >&2
  exit 2
fi

case "$1" in
  post-write-verify)
    NODE_SCRIPT_NAME="post-write-verify.mjs"
    ;;
  post-audit-log)
    NODE_SCRIPT_NAME="post-audit-log.mjs"
    ;;
  audit-compactor)
    NODE_SCRIPT_NAME="audit-compactor.mjs"
    ;;
  config-change-guard)
    NODE_SCRIPT_NAME="config-change-guard.mjs"
    ;;
  *)
    echo "[nova-plugin] Unknown guarded Node hook id: $1; hook blocked." >&2
    exit 2
    ;;
esac

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
  echo "[nova-plugin] A trusted Node.js 22+ executable outside the project is required by the active hook; hook blocked." >&2
  exit 2
fi

NODE_SCRIPT="$(nova_path_for_node_command "$SCRIPT_DIR/$NODE_SCRIPT_NAME" "$NODE_BIN")"
exec "$NODE_BIN" "$NODE_SCRIPT"

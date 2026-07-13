#!/usr/bin/env bash

# Shared Bash helpers for distributed nova-plugin runtime scripts.

nova_runtime_dir() {
  cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd
}

nova_plugin_root() {
  local runtime_dir=""
  runtime_dir="$(nova_runtime_dir)"
  cd "${runtime_dir}/.." >/dev/null 2>&1 && pwd
}

nova_command_usable_with_version() {
  local cmd="$1"
  shift
  local output=""
  local status=0

  command -v "$cmd" >/dev/null 2>&1 || return 1

  set +e
  output="$("$cmd" "$@" </dev/null 2>&1)"
  status=$?
  set -e

  [[ "$status" -eq 0 && -n "${output//[[:space:]]/}" ]] || return 1
  case "$output" in
    *"not found"*|*"No such file or directory"*|*"is not recognized"*)
      return 1
      ;;
  esac
}

nova_node_command() {
  local candidate=""
  for candidate in node node.exe; do
    if nova_command_usable_with_version "$candidate" --version; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

nova_node_command_is_windows() {
  local candidate="$1"
  local platform=""

  platform="$("$candidate" -e 'process.stdout.write(process.platform)' </dev/null 2>/dev/null || true)"
  [ "$platform" = "win32" ]
}

nova_path_for_node_command() {
  local path="$1"
  local node_bin="$2"
  local drive=""
  local rest=""

  if ! nova_node_command_is_windows "$node_bin"; then
    printf '%s\n' "$path"
    return 0
  fi

  case "$path" in
    /mnt/[A-Za-z]/*)
      rest="${path#/mnt/}"
      drive="${rest%%/*}"
      rest="${rest#*/}"
      drive="$(printf '%s' "$drive" | tr '[:lower:]' '[:upper:]')"
      printf '%s:/%s\n' "$drive" "$rest"
      ;;
    *)
      if command -v cygpath >/dev/null 2>&1; then
        cygpath -m "$path"
        return 0
      fi
      printf '%s\n' "$path"
      ;;
  esac
}

nova_secret_rules_path() {
  printf '%s\n' "$(nova_plugin_root)/runtime/secret-rules.mjs"
}

nova_secret_rules_path_for_node() {
  local node_bin="$1"
  nova_path_for_node_command "$(nova_secret_rules_path)" "$node_bin"
}

#!/usr/bin/env bash

# Shared Bash helpers for distributed nova-plugin runtime scripts.

nova_runtime_dir() {
  local source_path="${BASH_SOURCE[0]}"
  local source_parent="."
  case "$source_path" in
    */*) source_parent="${source_path%/*}" ;;
  esac
  cd -P -- "$source_parent" >/dev/null 2>&1 && builtin pwd -P
}

nova_plugin_root() {
  local runtime_dir=""
  runtime_dir="$(nova_runtime_dir)"
  cd -P -- "${runtime_dir}/.." >/dev/null 2>&1 && builtin pwd -P
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

nova_node_version_supported() {
  local cmd="$1"
  local output=""
  local version=""
  local major=""
  local status=0

  set +e
  output="$("$cmd" --version </dev/null 2>&1)"
  status=$?
  set -e
  [ "$status" -eq 0 ] || return 1
  case "$output" in
    v[0-9]*)
      version="${output#v}"
      major="${version%%.*}"
      case "$major" in
        ''|*[!0-9]*) return 1 ;;
      esac
      [ "$major" -ge 22 ]
      ;;
    *) return 1 ;;
  esac
}

nova_absolute_bash_path() {
  local path="$1"

  case "$path" in
    /*)
      printf '%s\n' "$path"
      ;;
    [A-Za-z]:[\\/]* )
      if [ -x /usr/bin/cygpath ]; then
        /usr/bin/cygpath -u "$path"
      elif [ -x /bin/cygpath ]; then
        /bin/cygpath -u "$path"
      else
        return 1
      fi
      ;;
    *)
      printf '%s/%s\n' "$(builtin pwd -P)" "$path"
      ;;
  esac
}

nova_canonical_path_entry() {
  local path=""
  local dir=""
  local base=""
  local physical_dir=""

  path="$(nova_absolute_bash_path "$1")" || return 1
  case "$path" in
    */*)
      dir="${path%/*}"
      base="${path##*/}"
      ;;
    *)
      return 1
      ;;
  esac
  [ -n "$dir" ] || dir="/"
  [ -n "$base" ] || return 1
  physical_dir="$(cd -P -- "$dir" >/dev/null 2>&1 && builtin pwd -P)" || return 1
  if [ "$physical_dir" = "/" ]; then
    printf '/%s\n' "$base"
  else
    printf '%s/%s\n' "$physical_dir" "$base"
  fi
}

nova_trusted_readlink() {
  if [ -x /usr/bin/readlink ]; then
    /usr/bin/readlink "$1"
  elif [ -x /bin/readlink ]; then
    /bin/readlink "$1"
  else
    return 1
  fi
}

nova_physical_executable_path() {
  local path=""
  local target=""
  local dir=""
  local hops=0

  path="$(nova_canonical_path_entry "$1")" || return 1
  while [ -L "$path" ]; do
    hops=$((hops + 1))
    [ "$hops" -le 40 ] || return 1
    target="$(nova_trusted_readlink "$path")" || return 1
    case "$target" in
      /*|[A-Za-z]:[\\/]*)
        path="$(nova_absolute_bash_path "$target")" || return 1
        ;;
      *)
        dir="${path%/*}"
        path="$dir/$target"
        ;;
    esac
    path="$(nova_canonical_path_entry "$path")" || return 1
  done
  [ -f "$path" ] && [ -x "$path" ] || return 1
  printf '%s\n' "$path"
}

nova_physical_directory_path() {
  local path=""
  path="$(nova_absolute_bash_path "$1")" || return 1
  cd -P -- "$path" >/dev/null 2>&1 && builtin pwd -P
}

nova_path_is_within() {
  local root="${1%/}"
  local path="$2"
  [ -n "$root" ] || root="/"
  if [ "$root" = "/" ]; then
    return 0
  fi
  case "$path" in
    "$root"|"$root"/*) return 0 ;;
    *) return 1 ;;
  esac
}

nova_node_command() {
  local workspace_root="${1:-}"
  local workspace_absolute=""
  local workspace_physical=""
  local candidate=""
  local candidate_from_path=""
  local candidate_absolute=""
  local candidate_entry=""

  [ "${NODE_OPTIONS+x}" != "x" ] || return 1
  if [ -n "$workspace_root" ]; then
    workspace_absolute="$(nova_absolute_bash_path "$workspace_root")" || return 1
    workspace_physical="$(nova_physical_directory_path "$workspace_root")" || return 1
  fi

  for candidate in node node.exe; do
    candidate_from_path="$(type -P "$candidate" 2>/dev/null || true)"
    [ -n "$candidate_from_path" ] || continue
    candidate_absolute="$(nova_absolute_bash_path "$candidate_from_path")" || return 1
    candidate_entry="$(nova_canonical_path_entry "$candidate_from_path")" || return 1
    candidate="$(nova_physical_executable_path "$candidate_entry")" || return 1
    if [ -n "$workspace_root" ] && {
      nova_path_is_within "$workspace_absolute" "$candidate_absolute" \
        || nova_path_is_within "$workspace_physical" "$candidate_entry" \
        || nova_path_is_within "$workspace_physical" "$candidate";
    }; then
      return 1
    fi
    if nova_node_version_supported "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
    continue
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
      printf '%s:/%s\n' "$drive" "$rest"
      ;;
    *)
      if [ -x /usr/bin/cygpath ]; then
        /usr/bin/cygpath -m "$path"
        return 0
      fi
      if [ -x /bin/cygpath ]; then
        /bin/cygpath -m "$path"
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

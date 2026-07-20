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

nova_physical_safe_path() {
  local workspace_root="${1:-}"
  local workspace_absolute=""
  local workspace_physical=""
  local original_path="${PATH-}"
  local entry=""
  local entry_absolute=""
  local entry_physical=""
  local safe_path=""
  local saved_dir=""
  local -a entries=()

  [ -n "$original_path" ] || return 1
  case ":$original_path:" in
    *::*) return 1 ;;
  esac

  if [ -n "$workspace_root" ]; then
    workspace_absolute="$(nova_absolute_bash_path "$workspace_root")" || return 1
    saved_dir="$PWD"
    cd -P -- "$workspace_root" >/dev/null 2>&1 || return 1
    workspace_physical="$PWD"
    cd -P -- "$saved_dir" >/dev/null 2>&1 || return 1
  fi

  IFS=':' read -r -a entries <<< "$original_path"
  for entry in "${entries[@]}"; do
    case "$entry" in
      /*|[A-Za-z]:[\\/]*) ;;
      *) return 1 ;;
    esac
    case "$entry" in
      *$'\n'*|*$'\r'*) return 1 ;;
    esac
    [ -d "$entry" ] || continue
    entry_absolute="$entry"
    saved_dir="$PWD"
    cd -P -- "$entry" >/dev/null 2>&1 || return 1
    entry_physical="$PWD"
    cd -P -- "$saved_dir" >/dev/null 2>&1 || return 1
    if [ -n "$workspace_root" ] && {
      nova_path_is_within "$workspace_absolute" "$entry_absolute" \
        || nova_path_is_within "$workspace_physical" "$entry_physical";
    }; then
      return 1
    fi
    case ":$safe_path:" in
      *:"$entry_physical":*) ;;
      *)
        if [ -n "$safe_path" ]; then
          safe_path="$safe_path:$entry_physical"
        else
          safe_path="$entry_physical"
        fi
        ;;
    esac
  done

  [ -n "$safe_path" ] || return 1
  printf '%s\n' "$safe_path"
}

nova_system_command() {
  local name="$1"
  local directory=""
  local candidate=""
  local physical=""

  case "$name" in
    ''|*/*|*\\*) return 1 ;;
  esac
  for directory in /usr/bin /bin; do
    for candidate in "$directory/$name" "$directory/$name.exe"; do
      [ -f "$candidate" ] && [ -x "$candidate" ] || continue
      physical="$(nova_physical_executable_path "$candidate")" || continue
      printf '%s\n' "$physical"
      return 0
    done
  done
  return 1
}

nova_trusted_stat_command() {
  if [ -n "${NOVA_TRUSTED_STAT_BIN:-}" ]; then
    printf '%s\n' "$NOVA_TRUSTED_STAT_BIN"
    return 0
  fi
  nova_system_command stat
}

nova_file_identity() {
  local path="$1"
  local stat_bin=""
  local identity=""

  stat_bin="$(nova_trusted_stat_command)" || return 1
  case "${NOVA_STAT_STYLE:-${OSTYPE:-}}" in
    bsd|darwin*) identity="$("$stat_bin" -f '%d:%i:%p:%z:%m:%c' "$path" 2>/dev/null)" || return 1 ;;
    gnu|linux*|msys*|cygwin*) identity="$("$stat_bin" -c '%d:%i:%f:%s:%Y:%Z' "$path" 2>/dev/null)" || return 1 ;;
    *)
      if identity="$("$stat_bin" -c '%d:%i:%f:%s:%Y:%Z' "$path" 2>/dev/null)"; then
        :
      else
        identity="$("$stat_bin" -f '%d:%i:%p:%z:%m:%c' "$path" 2>/dev/null)" || return 1
      fi
      ;;
  esac
  [ -n "$identity" ] || return 1
  printf '%s\n' "$identity"
}

nova_file_link_count() {
  local path="$1"
  local stat_bin=""
  local links=""

  stat_bin="$(nova_trusted_stat_command)" || return 1
  case "${NOVA_STAT_STYLE:-${OSTYPE:-}}" in
    bsd|darwin*) links="$("$stat_bin" -f '%l' "$path" 2>/dev/null)" || return 1 ;;
    gnu|linux*|msys*|cygwin*) links="$("$stat_bin" -c '%h' "$path" 2>/dev/null)" || return 1 ;;
    *)
      if links="$("$stat_bin" -c '%h' "$path" 2>/dev/null)"; then
        :
      else
        links="$("$stat_bin" -f '%l' "$path" 2>/dev/null)" || return 1
      fi
      ;;
  esac
  case "$links" in
    ''|*[!0-9]*) return 1 ;;
  esac
  printf '%s\n' "$links"
}

nova_executable_identity() {
  local path="$1"
  [ -f "$path" ] && [ -x "$path" ] || return 1
  nova_file_identity "$path"
}

nova_executable_identity_matches() {
  local path="$1"
  local expected="$2"
  local actual=""
  actual="$(nova_executable_identity "$path")" || return 1
  [ "$actual" = "$expected" ]
}

nova_native_executable_format() {
  local path="$1"
  local od_bin=""
  local bytes=""

  od_bin="$(nova_system_command od)" || return 1
  bytes="$(LC_ALL=C "$od_bin" -An -tx1 -N4 "$path" 2>/dev/null)" || return 1
  bytes="${bytes//[[:space:]]/}"
  case "$bytes" in
    7f454c46|feedface|feedfacf|cefaedfe|cffaedfe|cafebabe|bebafeca|cafebabf|bfbafeca|4d5a*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
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
  local candidate_identity=""
  local safe_path=""

  [ "${NODE_OPTIONS+x}" != "x" ] || return 1
  if [ -n "$workspace_root" ]; then
    workspace_absolute="$(nova_absolute_bash_path "$workspace_root")" || return 1
    workspace_physical="$(nova_physical_directory_path "$workspace_root")" || return 1
  fi
  safe_path="$(nova_physical_safe_path "$workspace_root")" || return 1

  for candidate in node node.exe; do
    candidate_from_path="$(PATH="$safe_path" type -P "$candidate" 2>/dev/null || true)"
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
    nova_native_executable_format "$candidate" || continue
    candidate_identity="$(nova_executable_identity "$candidate")" || continue
    if PATH="$safe_path" nova_node_version_supported "$candidate" \
      && nova_executable_identity_matches "$candidate" "$candidate_identity"; then
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

#!/usr/bin/env bash

# 通用函数库，供 codex-review / codex-verify / run-project-checks 复用。

set -o errexit
set -o nounset
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROMPTS_DIR="${SKILL_DIR}/prompts"

timestamp() {
  date +"%Y%m%d-%H%M%S"
}

info() {
  printf '[INFO] %s\n' "$*"
}

warn() {
  printf '[WARN] %s\n' "$*" >&2
}

error() {
  printf '[ERROR] %s\n' "$*" >&2
}

success() {
  printf '[OK] %s\n' "$*"
}

die() {
  error "$*"
  exit 1
}

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "未找到命令: ${cmd}"
}

ensure_git_repo() {
  git rev-parse --show-toplevel >/dev/null 2>&1 || die "当前目录不是 Git 仓库。"
}

repo_root() {
  git rev-parse --show-toplevel
}

resolve_path() {
  local input="$1"
  local normalized_input="$input"
  local resolved_dir=""
  local root=""
  local candidate=""
  local candidate_dir=""

  case "$input" in
    [A-Za-z]:\\*|\\\\*)
      normalized_input="${input//\\//}"
      printf '%s\n' "$normalized_input"
      return 0
      ;;
    /*|[A-Za-z]:/*|//*)
      printf '%s\n' "$input"
      return 0
      ;;
  esac

  if resolved_dir="$(cd "$(dirname "$input")" 2>/dev/null && pwd)"; then
    printf '%s\n' "${resolved_dir}/$(basename "$input")"
    return 0
  fi

  root="$(repo_root)"
  candidate="${root}/${input}"
  if candidate_dir="$(cd "$(dirname "$candidate")" 2>/dev/null && pwd)"; then
    printf '%s\n' "${candidate_dir}/$(basename "$candidate")"
    return 0
  fi

  die "无法解析路径: ${input}"
}

resolve_output_path() {
  local input="$1"
  local normalized_input="$input"
  local resolved_dir=""
  local root=""

  case "$input" in
    [A-Za-z]:\\*|\\\\*)
      normalized_input="${input//\\//}"
      printf '%s\n' "$normalized_input"
      return 0
      ;;
    /*|[A-Za-z]:/*|//*)
      printf '%s\n' "$input"
      return 0
      ;;
  esac

  if resolved_dir="$(cd "$(dirname "$input")" 2>/dev/null && pwd)"; then
    printf '%s\n' "${resolved_dir}/$(basename "$input")"
    return 0
  fi

  root="$(repo_root)"
  printf '%s\n' "${root}/${input}"
}

canonicalize_dir() {
  local dir="$1"
  cd "$dir" >/dev/null 2>&1 || die "无法解析目录: ${dir}"
  pwd
}

detect_default_base_branch() {
  local branch=""

  if branch="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)"; then
    printf '%s\n' "$branch"
    return 0
  fi

  for candidate in main master trunk develop; do
    if git show-ref --verify --quiet "refs/heads/${candidate}"; then
      printf '%s\n' "$candidate"
      return 0
    fi
    if git show-ref --verify --quiet "refs/remotes/origin/${candidate}"; then
      printf '%s\n' "origin/${candidate}"
      return 0
    fi
  done

  die "无法识别默认基线分支，请通过 --base 显式指定。"
}

ensure_output_dir() {
  local dir="$1"
  mkdir -p "$dir"
  printf '%s\n' "$dir"
}

default_output_dir() {
  local root
  root="$(repo_root)"
  printf '%s\n' "${root}/.codex/codex-review-fix/$(timestamp)"
}

prepare_temp_dir() {
  local parent="$1"
  local dir
  dir="${parent}/tmp.$(timestamp)"
  mkdir -p "$dir"
  printf '%s\n' "$dir"
}

prompt_file() {
  local name="$1"
  local file="${PROMPTS_DIR}/${name}"
  [[ -f "$file" ]] || die "未找到 prompt 模板: ${file}"
  printf '%s\n' "$file"
}

ensure_codex_available() {
  if ! CODEX_BIN="$(codex_executable)"; then
    die "未找到可运行的 codex 命令。请确认 Codex CLI 及其运行时依赖在当前 Bash 环境中可用。"
  fi
}

command_path_or_unknown() {
  local cmd="$1"
  command -v "$cmd" 2>/dev/null || printf 'not available\n'
}

first_nonempty_line() {
  local text="$1"
  local line=""
  while IFS= read -r line; do
    line="${line%$'\r'}"
    if [[ -n "${line//[[:space:]]/}" ]]; then
      printf '%s\n' "$line"
      return 0
    fi
  done <<< "$text"
  return 1
}

command_output_looks_unusable() {
  local output="$1"
  case "$output" in
    *"not found"*|*"No such file or directory"*|*"is not recognized"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

command_version_line() {
  local cmd="$1"
  shift
  local output=""
  local status=0
  local first_line=""
  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf 'not available\n'
    return 0
  fi

  set +e
  output="$("$cmd" "$@" 2>&1)"
  status=$?
  set -e

  first_line="$(first_nonempty_line "$output" || true)"
  if [[ "$status" -ne 0 || -z "$first_line" ]] || command_output_looks_unusable "$output"; then
    printf 'version unavailable\n'
    return 0
  fi

  printf '%s\n' "$first_line"
}

command_usable_with_version() {
  local cmd="$1"
  shift
  local output=""
  local status=0
  local first_line=""
  command -v "$cmd" >/dev/null 2>&1 || return 1

  set +e
  output="$("$cmd" "$@" 2>&1)"
  status=$?
  set -e

  first_line="$(first_nonempty_line "$output" || true)"
  [[ "$status" -eq 0 && -n "$first_line" ]] || return 1
  ! command_output_looks_unusable "$output"
}

node_executable() {
  local candidate=""
  for candidate in node node.exe; do
    if command_usable_with_version "$candidate" --version; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

codex_executable() {
  local candidate=""
  for candidate in codex codex.exe; do
    if command_usable_with_version "$candidate" --version; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

runtime_environment_lines() {
  local node_cmd=""
  local node_path=""
  local node_version=""
  local codex_cmd=""
  local codex_path=""
  local codex_version=""

  node_cmd="$(node_executable 2>/dev/null || true)"
  if [[ -n "$node_cmd" ]]; then
    node_path="$(command_path_or_unknown "$node_cmd")"
    node_version="$(command_version_line "$node_cmd" --version)"
  else
    node_path="$(command_path_or_unknown node)"
    node_version="$(command_version_line node --version)"
  fi

  codex_cmd="$(codex_executable 2>/dev/null || true)"
  if [[ -n "$codex_cmd" ]]; then
    codex_path="$(command_path_or_unknown "$codex_cmd")"
    codex_version="$(command_version_line "$codex_cmd" --version)"
  else
    codex_path="$(command_path_or_unknown codex)"
    codex_version="$(command_version_line codex --version)"
  fi

  printf 'timestamp_utc=%s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  printf 'pwd=%s\n' "$(pwd)"
  printf 'script_dir=%s\n' "${SCRIPT_DIR}"
  printf 'shell=%s\n' "${SHELL:-unknown}"
  printf 'uname=%s\n' "$(uname -a 2>/dev/null || printf 'not available')"
  printf 'git_path=%s\n' "$(command_path_or_unknown git)"
  printf 'git_version=%s\n' "$(command_version_line git --version)"
  printf 'bash_path=%s\n' "$(command_path_or_unknown bash)"
  printf 'bash_version=%s\n' "$(command_version_line bash --version)"
  printf 'node_command=%s\n' "${node_cmd:-not available}"
  printf 'node_path=%s\n' "$node_path"
  printf 'node_version=%s\n' "$node_version"
  printf 'codex_command=%s\n' "${codex_cmd:-not available}"
  printf 'codex_path=%s\n' "$codex_path"
  printf 'codex_version=%s\n' "$codex_version"
  printf 'codex_model=%s\n' "${CODEX_MODEL:-}"
  printf 'codex_profile=%s\n' "${CODEX_PROFILE:-}"
}

write_runtime_environment() {
  local output_file="$1"
  mkdir -p "$(dirname "$output_file")"
  runtime_environment_lines > "$output_file"
}

print_runtime_environment() {
  runtime_environment_lines
}

git_has_changes_against_base() {
  local base="$1"
  local merge_base=""
  merge_base="$(git merge-base "HEAD" "$base" 2>/dev/null || true)"
  [[ -n "$merge_base" ]] || return 1
  ! git diff --quiet "$merge_base"...HEAD
}

git_has_staged_changes() {
  ! git diff --cached --quiet
}

git_has_worktree_changes() {
  ! git diff --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]
}

write_untracked_diff() {
  local output_file="$1"
  local file=""

  while IFS= read -r -d '' file; do
    [[ -f "$file" ]] || continue
    {
      printf '\n### untracked file: %s\n' "$file"
      git diff --no-index --binary -- /dev/null "$file" 2>&1 || true
    } >> "$output_file"
  done < <(git ls-files --others --exclude-standard -z)
}

write_latest_pointer() {
  local output_dir="$1"
  local root
  root="$(repo_root)"
  mkdir -p "${root}/.codex/codex-review-fix"
  printf '%s\n' "$output_dir" > "${root}/.codex/codex-review-fix/latest"
  mkdir -p "${root}/.codex/codex-review-fix/latest-artifacts"
}

codex_exec_args() {
  local working_dir="$1"
  local model="${CODEX_MODEL:-}"
  local profile="${CODEX_PROFILE:-}"

  local -a args
  args=("exec" "-C" "$working_dir" "--sandbox" "read-only" "--skip-git-repo-check" "--color" "never" "--output-last-message")

  if [[ -n "$profile" ]]; then
    args+=("--profile" "$profile")
  fi
  if [[ -n "$model" ]]; then
    args+=("--model" "$model")
  fi

  printf '%s\n' "${args[@]}"
}

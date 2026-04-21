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
  if ! command -v codex >/dev/null 2>&1; then
    die "未找到 codex 命令。请先安装 Codex CLI 并完成登录，然后重试。可先执行: codex --help"
  fi
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

#!/usr/bin/env bash

set -euo pipefail

if [[ "${BASH_ENV+x}" == x || "${ENV+x}" == x ]]; then
  builtin printf '[ERROR] BASH_ENV/ENV 不能传入 Codex review 入口。\n' >&2
  exit 2
fi
if [[ -n "$(builtin compgen -A function 2>/dev/null || true)" ]]; then
  builtin printf '[ERROR] Codex review 入口拒绝继承 Bash 函数。\n' >&2
  exit 2
fi
if [[ -n "$(builtin compgen -A alias 2>/dev/null || true)" ]]; then
  builtin printf '[ERROR] Codex review 入口拒绝继承 Bash alias。\n' >&2
  exit 2
fi
if [[ -z "${PATH:-}" || ":${PATH}:" == *::* ]]; then
  builtin printf '[ERROR] Codex review 入口拒绝空 PATH 组件。\n' >&2
  exit 2
fi
NOVA_BOOTSTRAP_PWD="$(builtin pwd -P)"
IFS=':' read -r -a NOVA_BOOTSTRAP_PATH_ENTRIES <<< "$PATH"
for NOVA_BOOTSTRAP_PATH_ENTRY in "${NOVA_BOOTSTRAP_PATH_ENTRIES[@]}"; do
  case "$NOVA_BOOTSTRAP_PATH_ENTRY" in
    /*|[A-Za-z]:[\\/]*) ;;
    *)
      builtin printf '[ERROR] Codex review 入口拒绝相对 PATH 组件: %s\n' "$NOVA_BOOTSTRAP_PATH_ENTRY" >&2
      exit 2
      ;;
  esac
  if [[ -d "$NOVA_BOOTSTRAP_PATH_ENTRY" ]]; then
    NOVA_BOOTSTRAP_PATH_PHYSICAL="$(cd -P -- "$NOVA_BOOTSTRAP_PATH_ENTRY" >/dev/null 2>&1 && builtin pwd -P)" || {
      builtin printf '[ERROR] Codex review 入口无法验证 PATH 组件: %s\n' "$NOVA_BOOTSTRAP_PATH_ENTRY" >&2
      exit 2
    }
    case "$NOVA_BOOTSTRAP_PATH_PHYSICAL" in
      "$NOVA_BOOTSTRAP_PWD"|"$NOVA_BOOTSTRAP_PWD"/*)
        builtin printf '[ERROR] Codex review 入口拒绝当前工作区内 PATH 组件: %s\n' "$NOVA_BOOTSTRAP_PATH_ENTRY" >&2
        exit 2
        ;;
    esac
  fi
done
unset NOVA_BOOTSTRAP_PATH_ENTRIES NOVA_BOOTSTRAP_PATH_ENTRY NOVA_BOOTSTRAP_PATH_PHYSICAL NOVA_BOOTSTRAP_PWD
SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_PARENT="."
case "$SCRIPT_PATH" in
  */*) SCRIPT_PARENT="${SCRIPT_PATH%/*}" ;;
esac
SCRIPT_DIR="$(cd -P -- "$SCRIPT_PARENT" >/dev/null 2>&1 && builtin pwd -P)"
# shellcheck source=./codex-common.sh
source "${SCRIPT_DIR}/codex-common.sh"
trap abort_active_output EXIT

BASE_BRANCH=""
OUTPUT_DIR=""
ONLY_STAGED=false
FULL_MODE=false
INCLUDE_UNTRACKED_CONTENT=false

require_option_value() {
  local option="$1"
  local value="${2:-}"
  if [[ -z "$value" || "$value" == --* ]]; then
    die "${option} 需要参数值。"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      require_option_value "$1" "${2:-}"
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --output-dir)
      require_option_value "$1" "${2:-}"
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --only-staged)
      ONLY_STAGED=true
      shift
      ;;
    --full)
      FULL_MODE=true
      shift
      ;;
    --include-untracked-content)
      INCLUDE_UNTRACKED_CONTENT=true
      shift
      ;;
    -h|--help)
      trusted_cat <<'EOF'
Usage: codex-review.sh [--base <branch>] [--output-dir <dir>] [--only-staged] [--full] [--include-untracked-content]

  --base         基线分支，默认自动识别
  --output-dir   输出目录，必须位于 .codex/codex-review-fix/，默认使用时间戳子目录
  --only-staged  仅审查暂存区改动
  --full         在分支 diff 基础上额外包含未提交改动，并列出未跟踪文件
  --include-untracked-content
                 与 --full 配合使用；通过安全检查后才包含未跟踪文件内容
EOF
      exit 0
      ;;
    *)
      die "未知参数: $1"
      ;;
  esac
done

if [[ "$ONLY_STAGED" == true && "$FULL_MODE" == true ]]; then
  die "--only-staged 与 --full 不能同时使用。"
fi

if [[ "$INCLUDE_UNTRACKED_CONTENT" == true && "$FULL_MODE" != true ]]; then
  die "--include-untracked-content 必须与 --full 一起使用。"
fi

ensure_git_repo
ensure_codex_available

ROOT="$(repo_root)"
BASE_BRANCH="${BASE_BRANCH:-$(detect_default_base_branch)}"
OUTPUT_DIR="${OUTPUT_DIR:-$(default_output_dir)}"
OUTPUT_DIR="$(ensure_output_dir "$OUTPUT_DIR")"
OUTPUT_DIR="$(canonicalize_dir "$OUTPUT_DIR")"
ARTIFACTS_DIR="$(ensure_output_dir "${OUTPUT_DIR}/artifacts")"

REVIEW_FILE="${OUTPUT_DIR}/review.md"
PROMPT_TEMPLATE="$(prompt_file "codex-review.prompt.md")"
FINAL_PROMPT="${ARTIFACTS_DIR}/prompt.review.md"
PATCH_FILE="${ARTIFACTS_DIR}/branch.diff.patch"
STATUS_FILE="${ARTIFACTS_DIR}/git-status.txt"
FILES_FILE="${ARTIFACTS_DIR}/changed-files.txt"
SCOPE_FILE="${ARTIFACTS_DIR}/review.scope.txt"
UNTRACKED_FILE="${ARTIFACTS_DIR}/untracked-files.txt"
RUNTIME_FILE="${ARTIFACTS_DIR}/runtime-environment.txt"

REVIEW_FILE="$(prepare_output_file "$REVIEW_FILE")"
FINAL_PROMPT="$(prepare_output_file "$FINAL_PROMPT")"
PATCH_FILE="$(prepare_output_file "$PATCH_FILE")"
STATUS_FILE="$(prepare_output_file "$STATUS_FILE")"
FILES_FILE="$(prepare_output_file "$FILES_FILE")"
SCOPE_FILE="$(prepare_output_file "$SCOPE_FILE")"
UNTRACKED_FILE="$(prepare_output_file "$UNTRACKED_FILE")"
RUNTIME_FILE="$(prepare_output_file "$RUNTIME_FILE")"

info "仓库根目录: ${ROOT}"
info "输出目录: ${OUTPUT_DIR}"

write_runtime_environment "${RUNTIME_FILE}"
begin_output_file "${STATUS_FILE}"
trusted_git status --short >&9
finish_output_file
begin_output_file "${UNTRACKED_FILE}"
finish_output_file

if [[ "$ONLY_STAGED" == true ]]; then
  git_has_staged_changes || die "暂存区没有可审查的改动。"
  begin_output_file "${PATCH_FILE}"
  trusted_git diff --no-ext-diff --no-textconv --cached --binary --find-renames >&9
  finish_output_file
  begin_output_file "${FILES_FILE}"
  trusted_git diff --no-ext-diff --no-textconv --cached --name-only >&9
  finish_output_file
  begin_output_file "${SCOPE_FILE}"
  printf '%s\n' "scope=staged" "base_branch=${BASE_BRANCH}" >&9
  finish_output_file
elif [[ "$FULL_MODE" == true ]]; then
  git_has_changes_against_base "$BASE_BRANCH" || warn "当前分支相对 ${BASE_BRANCH} 没有已提交差异，将仅包含工作区改动。"
  begin_output_file "${PATCH_FILE}"
  {
    printf '### branch diff vs %s\n' "$BASE_BRANCH"
    trusted_git diff --no-ext-diff --no-textconv --binary --find-renames "${BASE_BRANCH}...HEAD" || true
    printf '\n### staged and unstaged worktree diff\n'
    trusted_git diff --no-ext-diff --no-textconv --binary --find-renames HEAD || true
  } >&9
  if [[ "$INCLUDE_UNTRACKED_CONTENT" == true ]]; then
    write_untracked_diff_stream >&9
  else
    warn "未跟踪文件内容默认不写入 review patch；如需包含内容，请显式使用 --include-untracked-content。"
  fi
  finish_output_file
  begin_output_file "${FILES_FILE}"
  {
    trusted_git diff --no-ext-diff --no-textconv --name-only "${BASE_BRANCH}...HEAD" || true
    trusted_git diff --no-ext-diff --no-textconv --name-only HEAD || true
    trusted_git ls-files --others --exclude-standard || true
  } | trusted_sort -u >&9
  finish_output_file
  begin_output_file "${UNTRACKED_FILE}"
  trusted_git ls-files --others --exclude-standard >&9 || true
  finish_output_file
  begin_output_file "${SCOPE_FILE}"
  printf '%s\n' \
    "scope=branch-plus-worktree" \
    "base_branch=${BASE_BRANCH}" \
    "include_untracked_content=${INCLUDE_UNTRACKED_CONTENT}" >&9
  finish_output_file
else
  git_has_changes_against_base "$BASE_BRANCH" || die "当前分支相对 ${BASE_BRANCH} 没有可审查差异。可改用 --only-staged 或 --full。"
  begin_output_file "${PATCH_FILE}"
  trusted_git diff --no-ext-diff --no-textconv --binary --find-renames "${BASE_BRANCH}...HEAD" >&9
  finish_output_file
  begin_output_file "${FILES_FILE}"
  trusted_git diff --no-ext-diff --no-textconv --name-only "${BASE_BRANCH}...HEAD" >&9
  finish_output_file
  begin_output_file "${SCOPE_FILE}"
  printf '%s\n' "scope=branch" "base_branch=${BASE_BRANCH}" >&9
  finish_output_file
fi

begin_output_file "${FINAL_PROMPT}"
trusted_cat "${PROMPT_TEMPLATE}" >&9
trusted_cat >&9 <<EOF

## 运行时上下文

- 仓库根目录: ${ROOT}
- 基线分支: ${BASE_BRANCH}
- 输出目录: ${OUTPUT_DIR}
- 审查范围文件: ${SCOPE_FILE}
- Git 状态文件: ${STATUS_FILE}
- 变更文件列表: ${FILES_FILE}
- Patch 文件: ${PATCH_FILE}
- 未跟踪文件列表: ${UNTRACKED_FILE}
- 运行环境文件: ${RUNTIME_FILE}

请阅读这些文件并产出最终 review 报告，直接输出 Markdown。
EOF
finish_output_file

CODEX_ARGS=()
while IFS= read -r arg; do
  CODEX_ARGS+=("$arg")
done < <(codex_exec_args "$ROOT")
begin_output_file "${REVIEW_FILE}"
if ! codex_invoke "${CODEX_ARGS[@]}" - < "${FINAL_PROMPT}" >&9; then
  abort_active_output
  die "Codex review 执行失败。"
fi
[[ -s "${ACTIVE_OUTPUT_STAGING}" ]] || {
  abort_active_output
  die "Codex 未生成 review.md。"
}
finish_output_file

[[ -s "${REVIEW_FILE}" ]] || die "Codex 未生成 review.md。"
write_latest_pointer "$OUTPUT_DIR"
LATEST_ARTIFACTS_DIR="${ROOT}/.codex/codex-review-fix/latest-artifacts"
LATEST_REVIEW_FILE="${LATEST_ARTIFACTS_DIR}/review.md"
LATEST_VERIFY_FILE="${LATEST_ARTIFACTS_DIR}/verify.md"
LATEST_CHECKS_FILE="${LATEST_ARTIFACTS_DIR}/checks.txt"
CURRENT_CHECKS_FILE="${ARTIFACTS_DIR}/checks.txt"
# 新 review 产生后，上一轮 verify/checks 作废。
trusted_rm -f "${LATEST_VERIFY_FILE}" "${LATEST_CHECKS_FILE}" "${CURRENT_CHECKS_FILE}"
if [[ "${REVIEW_FILE}" != "${LATEST_REVIEW_FILE}" ]]; then
  atomic_copy_output_file "${REVIEW_FILE}" "${LATEST_REVIEW_FILE}"
fi
success "Review 完成: ${REVIEW_FILE}"

#!/usr/bin/env bash

set -euo pipefail

if [[ "${BASH_ENV+x}" == x || "${ENV+x}" == x ]]; then
  builtin printf '[ERROR] BASH_ENV/ENV 不能传入 Codex verify 入口。\n' >&2
  exit 2
fi
if [[ -n "$(builtin compgen -A function 2>/dev/null || true)" ]]; then
  builtin printf '[ERROR] Codex verify 入口拒绝继承 Bash 函数。\n' >&2
  exit 2
fi
if [[ -n "$(builtin compgen -A alias 2>/dev/null || true)" ]]; then
  builtin printf '[ERROR] Codex verify 入口拒绝继承 Bash alias。\n' >&2
  exit 2
fi
if [[ -z "${PATH:-}" || ":${PATH}:" == *::* ]]; then
  builtin printf '[ERROR] Codex verify 入口拒绝空 PATH 组件。\n' >&2
  exit 2
fi
NOVA_BOOTSTRAP_PWD="$(builtin pwd -P)"
IFS=':' read -r -a NOVA_BOOTSTRAP_PATH_ENTRIES <<< "$PATH"
for NOVA_BOOTSTRAP_PATH_ENTRY in "${NOVA_BOOTSTRAP_PATH_ENTRIES[@]}"; do
  case "$NOVA_BOOTSTRAP_PATH_ENTRY" in
    /*|[A-Za-z]:[\\/]*) ;;
    *)
      builtin printf '[ERROR] Codex verify 入口拒绝相对 PATH 组件: %s\n' "$NOVA_BOOTSTRAP_PATH_ENTRY" >&2
      exit 2
      ;;
  esac
  if [[ -d "$NOVA_BOOTSTRAP_PATH_ENTRY" ]]; then
    NOVA_BOOTSTRAP_PATH_PHYSICAL="$(cd -P -- "$NOVA_BOOTSTRAP_PATH_ENTRY" >/dev/null 2>&1 && builtin pwd -P)" || {
      builtin printf '[ERROR] Codex verify 入口无法验证 PATH 组件: %s\n' "$NOVA_BOOTSTRAP_PATH_ENTRY" >&2
      exit 2
    }
    case "$NOVA_BOOTSTRAP_PATH_PHYSICAL" in
      "$NOVA_BOOTSTRAP_PWD"|"$NOVA_BOOTSTRAP_PWD"/*)
        builtin printf '[ERROR] Codex verify 入口拒绝当前工作区内 PATH 组件: %s\n' "$NOVA_BOOTSTRAP_PATH_ENTRY" >&2
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

REVIEW_FILE=""
BASE_BRANCH=""
OUTPUT_DIR=""
CHECKS_FILE=""
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
    --review-file)
      require_option_value "$1" "${2:-}"
      REVIEW_FILE="${2:-}"
      shift 2
      ;;
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
    --checks-file)
      require_option_value "$1" "${2:-}"
      CHECKS_FILE="${2:-}"
      shift 2
      ;;
    --include-untracked-content)
      INCLUDE_UNTRACKED_CONTENT=true
      shift
      ;;
    -h|--help)
      trusted_cat <<'EOF'
Usage: codex-verify.sh --review-file <path> [--base <branch>] [--output-dir <dir>] [--checks-file <path>] [--include-untracked-content]

  --review-file  上一轮 review.md 路径
  --base         基线分支，默认自动识别
  --output-dir   输出目录，必须位于 .codex/codex-review-fix/，默认复用 review 所在目录
  --checks-file  本地 checks 输出文件，可选
  --include-untracked-content
                 显式允许未跟踪文件内容进入 verify patch，且需通过安全检查
EOF
      exit 0
      ;;
    *)
      die "未知参数: $1"
      ;;
  esac
done

[[ -n "$REVIEW_FILE" ]] || die "必须通过 --review-file 提供上一轮 review.md。"

ensure_git_repo
ensure_codex_available

ROOT="$(repo_root)"
REVIEW_FILE="$(resolve_path "$REVIEW_FILE")"
[[ -f "$REVIEW_FILE" ]] || die "review 文件不存在: ${REVIEW_FILE}"

BASE_BRANCH="${BASE_BRANCH:-$(detect_default_base_branch)}"
OUTPUT_DIR="${OUTPUT_DIR:-$(path_dirname "$REVIEW_FILE")}"
OUTPUT_DIR="$(ensure_output_dir "$OUTPUT_DIR")"
OUTPUT_DIR="$(canonicalize_dir "$OUTPUT_DIR")"
ARTIFACTS_DIR="$(ensure_output_dir "${OUTPUT_DIR}/artifacts")"

VERIFY_FILE="${OUTPUT_DIR}/verify.md"
PROMPT_TEMPLATE="$(prompt_file "codex-verify.prompt.md")"
FINAL_PROMPT="${ARTIFACTS_DIR}/prompt.verify.md"
PATCH_FILE="${ARTIFACTS_DIR}/verify.diff.patch"
STATUS_FILE="${ARTIFACTS_DIR}/verify.git-status.txt"
FILES_FILE="${ARTIFACTS_DIR}/verify.changed-files.txt"
RUNTIME_FILE="${ARTIFACTS_DIR}/verify.runtime-environment.txt"

VERIFY_FILE="$(prepare_output_file "$VERIFY_FILE")"
FINAL_PROMPT="$(prepare_output_file "$FINAL_PROMPT")"
PATCH_FILE="$(prepare_output_file "$PATCH_FILE")"
STATUS_FILE="$(prepare_output_file "$STATUS_FILE")"
FILES_FILE="$(prepare_output_file "$FILES_FILE")"
RUNTIME_FILE="$(prepare_output_file "$RUNTIME_FILE")"

if [[ -n "$CHECKS_FILE" ]]; then
  CHECKS_FILE="$(resolve_path "$CHECKS_FILE")"
  [[ -f "$CHECKS_FILE" ]] || die "checks 文件不存在: ${CHECKS_FILE}"
else
  for candidate in \
    "${OUTPUT_DIR}/artifacts/checks.txt" \
    "${ROOT}/.codex/codex-review-fix/latest-artifacts/checks.txt"
  do
    if [[ -f "$candidate" ]]; then
      CHECKS_FILE="$candidate"
      break
    fi
  done
fi

write_runtime_environment "${RUNTIME_FILE}"
begin_output_file "${STATUS_FILE}"
trusted_git status --short >&9
finish_output_file
begin_output_file "${PATCH_FILE}"
{
  trusted_git diff --no-ext-diff --no-textconv --binary --find-renames "${BASE_BRANCH}...HEAD" || true
  printf '\n### worktree diff\n'
  trusted_git diff --no-ext-diff --no-textconv --binary --find-renames HEAD || true
} >&9
if [[ "$INCLUDE_UNTRACKED_CONTENT" == true ]]; then
  write_untracked_diff_stream >&9
else
  warn "未跟踪文件内容默认不写入 verify patch；如需包含内容，请显式使用 --include-untracked-content。"
fi
finish_output_file
begin_output_file "${FILES_FILE}"
{
  trusted_git diff --no-ext-diff --no-textconv --name-only "${BASE_BRANCH}...HEAD" || true
  trusted_git diff --no-ext-diff --no-textconv --name-only HEAD || true
  trusted_git ls-files --others --exclude-standard || true
} | trusted_sort -u >&9
finish_output_file

begin_output_file "${FINAL_PROMPT}"
trusted_cat "${PROMPT_TEMPLATE}" >&9
trusted_cat >&9 <<EOF

## 运行时上下文

- 仓库根目录: ${ROOT}
- 基线分支: ${BASE_BRANCH}
- 上一轮 review 文件: ${REVIEW_FILE}
- 本地 checks 文件: ${CHECKS_FILE:-未提供，请不要假设 checks 已通过}
- Git 状态文件: ${STATUS_FILE}
- 当前变更文件列表: ${FILES_FILE}
- 当前 patch 文件: ${PATCH_FILE}
- 运行环境文件: ${RUNTIME_FILE}

请先读取 review 文件；如果提供了 checks 文件，也要把它纳入验证依据。直接输出 Markdown。
EOF
finish_output_file

CODEX_ARGS=()
while IFS= read -r arg; do
  CODEX_ARGS+=("$arg")
done < <(codex_exec_args "$ROOT")
begin_output_file "${VERIFY_FILE}"
if ! codex_invoke "${CODEX_ARGS[@]}" - < "${FINAL_PROMPT}" >&9; then
  abort_active_output
  die "Codex verify 执行失败。"
fi
[[ -s "${ACTIVE_OUTPUT_STAGING}" ]] || {
  abort_active_output
  die "Codex 未生成 verify.md。"
}
finish_output_file

[[ -s "${VERIFY_FILE}" ]] || die "Codex 未生成 verify.md。"
write_latest_pointer "$OUTPUT_DIR"
LATEST_VERIFY_FILE="${ROOT}/.codex/codex-review-fix/latest-artifacts/verify.md"
if [[ "${VERIFY_FILE}" != "${LATEST_VERIFY_FILE}" ]]; then
  atomic_copy_output_file "${VERIFY_FILE}" "${LATEST_VERIFY_FILE}"
fi
success "Verify 完成: ${VERIFY_FILE}"

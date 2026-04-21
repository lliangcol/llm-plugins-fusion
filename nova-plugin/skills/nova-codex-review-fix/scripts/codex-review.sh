#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./codex-common.sh
source "${SCRIPT_DIR}/codex-common.sh"

BASE_BRANCH=""
OUTPUT_DIR=""
ONLY_STAGED=false
FULL_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --output-dir)
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
    -h|--help)
      cat <<'EOF'
Usage: codex-review.sh [--base <branch>] [--output-dir <dir>] [--only-staged] [--full]

  --base         基线分支，默认自动识别
  --output-dir   输出目录，默认 .codex/codex-review-fix/<timestamp>
  --only-staged  仅审查暂存区改动
  --full         在分支 diff 基础上额外包含未提交改动与未跟踪文件摘要
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

info "仓库根目录: ${ROOT}"
info "输出目录: ${OUTPUT_DIR}"

git status --short > "${STATUS_FILE}"
: > "${UNTRACKED_FILE}"

if [[ "$ONLY_STAGED" == true ]]; then
  git_has_staged_changes || die "暂存区没有可审查的改动。"
  git diff --cached --binary --find-renames > "${PATCH_FILE}"
  git diff --cached --name-only > "${FILES_FILE}"
  printf '%s\n' "scope=staged" "base_branch=${BASE_BRANCH}" > "${SCOPE_FILE}"
elif [[ "$FULL_MODE" == true ]]; then
  git_has_changes_against_base "$BASE_BRANCH" || warn "当前分支相对 ${BASE_BRANCH} 没有已提交差异，将仅包含工作区改动。"
  {
    printf '### branch diff vs %s\n' "$BASE_BRANCH"
    git diff --binary --find-renames "${BASE_BRANCH}...HEAD" || true
    printf '\n### staged and unstaged worktree diff\n'
    git diff --binary --find-renames HEAD || true
  } > "${PATCH_FILE}"
  {
    git diff --name-only "${BASE_BRANCH}...HEAD" || true
    git diff --name-only HEAD || true
    git ls-files --others --exclude-standard || true
  } | sort -u > "${FILES_FILE}"
  git ls-files --others --exclude-standard > "${UNTRACKED_FILE}" || true
  printf '%s\n' "scope=branch-plus-worktree" "base_branch=${BASE_BRANCH}" > "${SCOPE_FILE}"
else
  git_has_changes_against_base "$BASE_BRANCH" || die "当前分支相对 ${BASE_BRANCH} 没有可审查差异。可改用 --only-staged 或 --full。"
  git diff --binary --find-renames "${BASE_BRANCH}...HEAD" > "${PATCH_FILE}"
  git diff --name-only "${BASE_BRANCH}...HEAD" > "${FILES_FILE}"
  printf '%s\n' "scope=branch" "base_branch=${BASE_BRANCH}" > "${SCOPE_FILE}"
fi

cat > "${FINAL_PROMPT}" <<EOF
$(cat "${PROMPT_TEMPLATE}")

## 运行时上下文

- 仓库根目录: ${ROOT}
- 基线分支: ${BASE_BRANCH}
- 输出目录: ${OUTPUT_DIR}
- 审查范围文件: ${SCOPE_FILE}
- Git 状态文件: ${STATUS_FILE}
- 变更文件列表: ${FILES_FILE}
- Patch 文件: ${PATCH_FILE}
- 未跟踪文件列表: ${UNTRACKED_FILE}

请阅读这些文件并产出最终 review 报告，直接输出 Markdown。
EOF

mapfile -t CODEX_ARGS < <(codex_exec_args "$ROOT")
codex "${CODEX_ARGS[@]}" "${REVIEW_FILE}" - < "${FINAL_PROMPT}"

[[ -s "${REVIEW_FILE}" ]] || die "Codex 未生成 review.md。"
write_latest_pointer "$OUTPUT_DIR"
LATEST_ARTIFACTS_DIR="${ROOT}/.codex/codex-review-fix/latest-artifacts"
LATEST_REVIEW_FILE="${LATEST_ARTIFACTS_DIR}/review.md"
LATEST_VERIFY_FILE="${LATEST_ARTIFACTS_DIR}/verify.md"
# 新 review 产生后，上一轮 verify 作废。
rm -f "${LATEST_VERIFY_FILE}"
if [[ "${REVIEW_FILE}" != "${LATEST_REVIEW_FILE}" ]]; then
  cp -f "${REVIEW_FILE}" "${LATEST_REVIEW_FILE}"
fi
success "Review 完成: ${REVIEW_FILE}"

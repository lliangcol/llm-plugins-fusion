#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./codex-common.sh
source "${SCRIPT_DIR}/codex-common.sh"

REVIEW_FILE=""
BASE_BRANCH=""
OUTPUT_DIR=""
CHECKS_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --review-file)
      REVIEW_FILE="${2:-}"
      shift 2
      ;;
    --base)
      BASE_BRANCH="${2:-}"
      shift 2
      ;;
    --output-dir)
      OUTPUT_DIR="${2:-}"
      shift 2
      ;;
    --checks-file)
      CHECKS_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage: codex-verify.sh --review-file <path> [--base <branch>] [--output-dir <dir>] [--checks-file <path>]

  --review-file  上一轮 review.md 路径
  --base         基线分支，默认自动识别
  --output-dir   输出目录，默认复用 review 所在目录
  --checks-file  本地 checks 输出文件，可选
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
OUTPUT_DIR="${OUTPUT_DIR:-$(dirname "$REVIEW_FILE")}"
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
git status --short > "${STATUS_FILE}"
{
  git diff --binary --find-renames "${BASE_BRANCH}...HEAD" || true
  printf '\n### worktree diff\n'
  git diff --binary --find-renames HEAD || true
} > "${PATCH_FILE}"
write_untracked_diff "${PATCH_FILE}"
{
  git diff --name-only "${BASE_BRANCH}...HEAD" || true
  git diff --name-only HEAD || true
  git ls-files --others --exclude-standard || true
} | sort -u > "${FILES_FILE}"

cat > "${FINAL_PROMPT}" <<EOF
$(cat "${PROMPT_TEMPLATE}")

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

mapfile -t CODEX_ARGS < <(codex_exec_args "$ROOT")
"${CODEX_BIN}" "${CODEX_ARGS[@]}" "${VERIFY_FILE}" - < "${FINAL_PROMPT}"

[[ -s "${VERIFY_FILE}" ]] || die "Codex 未生成 verify.md。"
write_latest_pointer "$OUTPUT_DIR"
LATEST_VERIFY_FILE="${ROOT}/.codex/codex-review-fix/latest-artifacts/verify.md"
if [[ "${VERIFY_FILE}" != "${LATEST_VERIFY_FILE}" ]]; then
  cp "${VERIFY_FILE}" "${LATEST_VERIFY_FILE}"
fi
success "Verify 完成: ${VERIFY_FILE}"

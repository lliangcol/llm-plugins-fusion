#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./codex-common.sh
source "${SCRIPT_DIR}/codex-common.sh"

MODE="all"
REPORT_FILE=""
declare -a TASKS=()

usage() {
  cat <<'EOF'
Usage: run-project-checks.sh [--lint-only | --test-only | --build-only | --all]

  --lint-only   仅执行 lint / repo checks
  --test-only   仅执行 test
  --build-only  仅执行 build
  --all         依次执行 repo checks、lint、test、build
  --report-file 将完整输出写入指定文件
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lint-only)
      MODE="lint"
      shift
      ;;
    --test-only)
      MODE="test"
      shift
      ;;
    --build-only)
      MODE="build"
      shift
      ;;
    --all)
      MODE="all"
      shift
      ;;
    --report-file)
      REPORT_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "未知参数: $1"
      ;;
  esac
done

ensure_git_repo
ROOT="$(repo_root)"

if [[ -n "$REPORT_FILE" ]]; then
  REPORT_FILE="$(resolve_path "$REPORT_FILE")"
  mkdir -p "$(dirname "$REPORT_FILE")"
  exec > >(tee "$REPORT_FILE") 2>&1
  info "检查输出将写入: ${REPORT_FILE}"
fi

manager_for_dir() {
  local dir="$1"
  if [[ -f "${dir}/pnpm-lock.yaml" || -f "${ROOT}/pnpm-lock.yaml" ]]; then
    printf 'pnpm\n'
  elif [[ -f "${dir}/yarn.lock" || -f "${ROOT}/yarn.lock" ]]; then
    printf 'yarn\n'
  elif [[ -f "${dir}/bun.lockb" || -f "${ROOT}/bun.lockb" ]]; then
    printf 'bun\n'
  else
    printf 'npm\n'
  fi
}

package_has_script() {
  local dir="$1"
  local script_name="$2"
  node -e "const p=require('path').join(process.argv[1],'package.json');const pkg=JSON.parse(require('fs').readFileSync(p,'utf8'));process.exit(pkg.scripts&&pkg.scripts[process.argv[2]]?0:1);" "$dir" "$script_name" >/dev/null 2>&1
}

append_task() {
  local phase="$1"
  local label="$2"
  local dir="$3"
  local cmd="$4"
  TASKS+=("${phase}|${label}|${dir}|${cmd}")
}

discover_repo_tasks() {
  if [[ -f "${ROOT}/scripts/verify-agents.sh" ]]; then
    append_task "lint" "repo verify-agents" "${ROOT}" "bash scripts/verify-agents.sh"
  fi

  if [[ -f "${ROOT}/scripts/validate-schemas.mjs" ]] && command -v node >/dev/null 2>&1; then
    append_task "lint" "repo validate-schemas" "${ROOT}" "node scripts/validate-schemas.mjs"
  fi

  if [[ -f "${ROOT}/scripts/lint-frontmatter.mjs" ]] && command -v node >/dev/null 2>&1; then
    append_task "lint" "repo lint-frontmatter" "${ROOT}" "node scripts/lint-frontmatter.mjs"
  fi
}

discover_node_tasks() {
  command -v node >/dev/null 2>&1 || {
    warn "未找到 node，跳过 package.json 脚本发现。"
    return 0
  }

  mapfile -t PKGS < <(find "${ROOT}" \
    \( -path "*/node_modules" -o -path "*/dist" -o -path "*/build" -o -path "*/target" -o -path "*/.codex" -o -path "*/.next" -o -path "*/.nuxt" -o -path "*/out" \) -prune \
    -o -name package.json -print)
  for pkg in "${PKGS[@]}"; do
    local dir
    dir="$(dirname "$pkg")"
    local manager
    manager="$(manager_for_dir "$dir")"

    if package_has_script "$dir" "check"; then
      append_task "lint" "${dir#${ROOT}/}:check" "$dir" "${manager} run check"
    fi
    if package_has_script "$dir" "lint"; then
      append_task "lint" "${dir#${ROOT}/}:lint" "$dir" "${manager} run lint"
    fi
    if package_has_script "$dir" "test"; then
      append_task "test" "${dir#${ROOT}/}:test" "$dir" "${manager} run test"
    fi
    if package_has_script "$dir" "build"; then
      append_task "build" "${dir#${ROOT}/}:build" "$dir" "${manager} run build"
    fi
  done
}

should_run_phase() {
  local phase="$1"
  case "$MODE" in
    all)
      return 0
      ;;
    lint)
      [[ "$phase" == "lint" ]]
      ;;
    test)
      [[ "$phase" == "test" ]]
      ;;
    build)
      [[ "$phase" == "build" ]]
      ;;
    *)
      return 1
      ;;
  esac
}

discover_repo_tasks
discover_node_tasks

[[ ${#TASKS[@]} -gt 0 ]] || die "未发现可执行的仓库检查任务。"

executed=0
failed=0

for task in "${TASKS[@]}"; do
  IFS='|' read -r phase label dir cmd <<< "$task"
  if ! should_run_phase "$phase"; then
    continue
  fi

  info "执行 ${phase}: ${label}"
  if (cd "$dir" && eval "$cmd"); then
    success "${label}"
    executed=$((executed + 1))
  else
    error "${label} 失败"
    failed=$((failed + 1))
  fi
done

[[ "$executed" -gt 0 ]] || die "当前模式 (${MODE}) 下没有发现可执行任务。"

printf '\nSummary: executed=%s failed=%s mode=%s\n' "$executed" "$failed" "$MODE"

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi

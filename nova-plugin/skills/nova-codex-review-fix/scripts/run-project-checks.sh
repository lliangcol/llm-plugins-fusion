#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./codex-common.sh
source "${SCRIPT_DIR}/codex-common.sh"

MODE="all"
REPORT_FILE=""
declare -a TASK_PHASES=()
declare -a TASK_LABELS=()
declare -a TASK_DIRS=()
declare -a TASK_KINDS=()
declare -a TASK_ARG1=()
declare -a TASK_ARG2=()
declare -a TASK_ARG3=()

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
      if [[ $# -lt 2 || -z "${2:-}" || "${2:-}" == --* ]]; then
        die "--report-file 需要路径参数。"
      fi
      REPORT_FILE="$2"
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
  REPORT_FILE="$(resolve_output_path "$REPORT_FILE")"
  mkdir -p "$(dirname "$REPORT_FILE")"
  exec > >(tee "$REPORT_FILE") 2>&1
  info "检查输出将写入: ${REPORT_FILE}"
fi

info "运行环境:"
print_runtime_environment

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

path_for_node() {
  local input="$1"
  if [[ "${NODE_BIN:-}" == *.exe ]] && command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$input"
  elif [[ "${NODE_BIN:-}" == *.exe ]] && command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$input"
  else
    printf '%s\n' "$input"
  fi
}

package_has_script() {
  local dir="$1"
  local script_name="$2"
  local node_dir=""
  node_dir="$(path_for_node "$dir")"
  "${NODE_BIN:-node}" -e "const p=require('path').join(process.argv[1],'package.json');const pkg=JSON.parse(require('fs').readFileSync(p,'utf8'));process.exit(pkg.scripts&&pkg.scripts[process.argv[2]]?0:1);" "$node_dir" "$script_name" >/dev/null 2>&1
}

append_task() {
  local phase="$1"
  local label="$2"
  local dir="$3"
  local kind="$4"
  local arg1="${5:-}"
  local arg2="${6:-}"
  local arg3="${7:-}"
  TASK_PHASES+=("$phase")
  TASK_LABELS+=("$label")
  TASK_DIRS+=("$dir")
  TASK_KINDS+=("$kind")
  TASK_ARG1+=("$arg1")
  TASK_ARG2+=("$arg2")
  TASK_ARG3+=("$arg3")
}

append_node_task() {
  local label="$1"
  local script="$2"
  local node_bin=""
  if node_bin="$(node_executable)"; then
    append_task "lint" "repo ${label}" "${ROOT}" "node-script" "$node_bin" "$script"
  else
    append_task "lint" "repo ${label}" "${ROOT}" "missing-node" "$script"
  fi
}

discover_repo_tasks() {
  if [[ -f "${ROOT}/scripts/verify-agents.sh" ]]; then
    append_task "lint" "repo verify-agents" "${ROOT}" "bash-script" "scripts/verify-agents.sh"
  fi

  if [[ -f "${ROOT}/scripts/validate-schemas.mjs" ]]; then
    append_node_task "validate-schemas" "scripts/validate-schemas.mjs"
  fi

  if [[ -f "${ROOT}/scripts/validate-registry-fixtures.mjs" ]]; then
    append_node_task "validate-registry-fixtures" "scripts/validate-registry-fixtures.mjs"
  fi

  if [[ -f "${ROOT}/scripts/validate-claude-compat.mjs" ]]; then
    append_node_task "validate-claude-compat" "scripts/validate-claude-compat.mjs"
  fi

  if [[ -f "${ROOT}/scripts/lint-frontmatter.mjs" ]]; then
    append_node_task "lint-frontmatter" "scripts/lint-frontmatter.mjs"
  fi

  if [[ -f "${ROOT}/scripts/validate-packs.mjs" ]]; then
    append_node_task "validate-packs" "scripts/validate-packs.mjs"
  fi

  if [[ -f "${ROOT}/scripts/validate-hooks.mjs" ]]; then
    append_node_task "validate-hooks" "scripts/validate-hooks.mjs"
  fi

  if [[ -f "${ROOT}/scripts/validate-runtime-smoke.mjs" ]]; then
    append_node_task "validate-runtime-smoke" "scripts/validate-runtime-smoke.mjs"
  fi

  if [[ -f "${ROOT}/scripts/scan-distribution-risk.mjs" ]]; then
    append_node_task "scan-distribution-risk" "scripts/scan-distribution-risk.mjs"
  fi

  if [[ -f "${ROOT}/scripts/validate-regression.mjs" ]]; then
    append_node_task "validate-regression" "scripts/validate-regression.mjs"
  fi

  if [[ -f "${ROOT}/scripts/validate-docs.mjs" ]]; then
    append_node_task "validate-docs" "scripts/validate-docs.mjs"
  fi

  if command -v bash >/dev/null 2>&1; then
    if [[ -f "${ROOT}/nova-plugin/hooks/scripts/pre-write-check.sh" ]]; then
      append_task "lint" "hook syntax pre-write-check" "${ROOT}" "bash-syntax" "nova-plugin/hooks/scripts/pre-write-check.sh"
    fi
    if [[ -f "${ROOT}/nova-plugin/hooks/scripts/post-audit-log.sh" ]]; then
      append_task "lint" "hook syntax post-audit-log" "${ROOT}" "bash-syntax" "nova-plugin/hooks/scripts/post-audit-log.sh"
    fi
  else
    warn "未找到 bash，跳过 hook 脚本语法检查。"
  fi
}

discover_node_tasks() {
  if ! NODE_BIN="$(node_executable)"; then
    warn "未找到 node，跳过 package.json 脚本发现。"
    return 0
  fi

  mapfile -t PKGS < <(find "${ROOT}" \
    \( -path "*/node_modules" -o -path "*/dist" -o -path "*/build" -o -path "*/target" -o -path "*/.codex" -o -path "*/.cache" -o -path "*/.idea" -o -path "*/.vite" -o -path "*/.vscode" -o -path "*/coverage" -o -path "*/logs" -o -path "*/tmp" -o -path "*/temp" -o -path "*/.runtime-smoke-*" -o -path "*/.next" -o -path "*/.nuxt" -o -path "*/out" \) -prune \
    -o -name package.json -print 2>/dev/null)
  for pkg in "${PKGS[@]}"; do
    local dir
    dir="$(dirname "$pkg")"
    local manager
    manager="$(manager_for_dir "$dir")"
    local display_dir
    display_dir="${dir#${ROOT}/}"
    if [[ "$display_dir" == "$dir" ]]; then
      display_dir="."
    fi

    if package_has_script "$dir" "check"; then
      append_task "lint" "${display_dir}:check" "$dir" "package-script" "$manager" "check"
    fi
    if package_has_script "$dir" "lint"; then
      append_task "lint" "${display_dir}:lint" "$dir" "package-script" "$manager" "lint"
    fi
    if package_has_script "$dir" "test"; then
      append_task "test" "${display_dir}:test" "$dir" "package-script" "$manager" "test"
    fi
    if package_has_script "$dir" "build"; then
      append_task "build" "${display_dir}:build" "$dir" "package-script" "$manager" "build"
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

run_task() {
  local kind="$1"
  local arg1="${2:-}"
  local arg2="${3:-}"
  local arg3="${4:-}"

  case "$kind" in
    bash-script)
      bash "$arg1"
      ;;
    bash-syntax)
      bash -n "$arg1"
      ;;
    node-script)
      "$arg1" "$arg2"
      ;;
    missing-node)
      printf '%s\n' "node is required to run ${arg1}" >&2
      return 1
      ;;
    package-script)
      case "$arg1" in
        npm|pnpm|yarn|bun)
          ;;
        *)
          printf '%s\n' "unsupported package manager: ${arg1}" >&2
          return 1
          ;;
      esac
      command -v "$arg1" >/dev/null 2>&1 || {
        printf '%s\n' "package manager not found: ${arg1}" >&2
        return 1
      }
      "$arg1" run "$arg2"
      ;;
    *)
      printf '%s\n' "unsupported task kind: ${kind}" >&2
      return 1
      ;;
  esac
}

discover_repo_tasks
discover_node_tasks

[[ ${#TASK_PHASES[@]} -gt 0 ]] || die "未发现可执行的仓库检查任务。"

executed=0
failed=0

for index in "${!TASK_PHASES[@]}"; do
  phase="${TASK_PHASES[$index]}"
  label="${TASK_LABELS[$index]}"
  dir="${TASK_DIRS[$index]}"
  kind="${TASK_KINDS[$index]}"
  if ! should_run_phase "$phase"; then
    continue
  fi

  info "执行 ${phase}: ${label}"
  if (cd "$dir" && run_task "$kind" "${TASK_ARG1[$index]}" "${TASK_ARG2[$index]}" "${TASK_ARG3[$index]}"); then
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

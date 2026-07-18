#!/usr/bin/env bash

# 通用函数库，供 codex-review / codex-verify / run-project-checks 复用。

set -o errexit
set -o nounset
set -o pipefail

NOVA_CODEX_COMMON_ENTRY_MODE=executed
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  NOVA_CODEX_COMMON_ENTRY_MODE=sourced
fi

if [[ "${BASH_ENV+x}" == x || "${ENV+x}" == x ]]; then
  builtin printf '[ERROR] BASH_ENV/ENV 不能传入 Codex review 运行时。\n' >&2
  if [[ "$NOVA_CODEX_COMMON_ENTRY_MODE" == sourced ]]; then
    return 2
  else
    exit 2
  fi
fi
if [[ -n "$(builtin compgen -A function 2>/dev/null || true)" ]]; then
  builtin printf '[ERROR] Codex review 运行时拒绝继承 Bash 函数。\n' >&2
  if [[ "$NOVA_CODEX_COMMON_ENTRY_MODE" == sourced ]]; then
    return 2
  else
    exit 2
  fi
fi
if [[ -n "$(builtin compgen -A alias 2>/dev/null || true)" ]]; then
  builtin printf '[ERROR] Codex review 运行时拒绝继承 Bash alias。\n' >&2
  if [[ "$NOVA_CODEX_COMMON_ENTRY_MODE" == sourced ]]; then
    return 2
  else
    exit 2
  fi
fi
if [[ -z "${PATH:-}" || ":${PATH}:" == *::* ]]; then
  builtin printf '[ERROR] Codex review 运行时拒绝空 PATH 组件。\n' >&2
  if [[ "$NOVA_CODEX_COMMON_ENTRY_MODE" == sourced ]]; then
    return 2
  else
    exit 2
  fi
fi
NOVA_BOOTSTRAP_PWD="$(builtin pwd -P)"
IFS=':' read -r -a NOVA_BOOTSTRAP_PATH_ENTRIES <<< "$PATH"
for NOVA_BOOTSTRAP_PATH_ENTRY in "${NOVA_BOOTSTRAP_PATH_ENTRIES[@]}"; do
  case "$NOVA_BOOTSTRAP_PATH_ENTRY" in
    /*|[A-Za-z]:[\\/]*) ;;
    *)
      builtin printf '[ERROR] Codex review 运行时拒绝相对 PATH 组件: %s\n' "$NOVA_BOOTSTRAP_PATH_ENTRY" >&2
      if [[ "$NOVA_CODEX_COMMON_ENTRY_MODE" == sourced ]]; then
        return 2
      else
        exit 2
      fi
      ;;
  esac
  if [[ -d "$NOVA_BOOTSTRAP_PATH_ENTRY" ]]; then
    NOVA_BOOTSTRAP_PATH_PHYSICAL="$(cd -P -- "$NOVA_BOOTSTRAP_PATH_ENTRY" >/dev/null 2>&1 && builtin pwd -P)" || {
      builtin printf '[ERROR] Codex review 运行时无法验证 PATH 组件: %s\n' "$NOVA_BOOTSTRAP_PATH_ENTRY" >&2
      if [[ "$NOVA_CODEX_COMMON_ENTRY_MODE" == sourced ]]; then
        return 2
      else
        exit 2
      fi
    }
    case "$NOVA_BOOTSTRAP_PATH_PHYSICAL" in
      "$NOVA_BOOTSTRAP_PWD"|"$NOVA_BOOTSTRAP_PWD"/*)
        builtin printf '[ERROR] Codex review 运行时拒绝当前工作区内 PATH 组件: %s\n' "$NOVA_BOOTSTRAP_PATH_ENTRY" >&2
        if [[ "$NOVA_CODEX_COMMON_ENTRY_MODE" == sourced ]]; then
          return 2
        else
          exit 2
        fi
        ;;
    esac
  fi
done
unset NOVA_BOOTSTRAP_PATH_ENTRIES NOVA_BOOTSTRAP_PATH_ENTRY NOVA_BOOTSTRAP_PATH_PHYSICAL NOVA_BOOTSTRAP_PWD NOVA_CODEX_COMMON_ENTRY_MODE

SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_PARENT="."
case "$SCRIPT_PATH" in
  */*) SCRIPT_PARENT="${SCRIPT_PATH%/*}" ;;
esac
SCRIPT_DIR="$(cd -P -- "$SCRIPT_PARENT" >/dev/null 2>&1 && builtin pwd -P)"
SKILL_DIR="$(cd -P -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && builtin pwd -P)"
PROMPTS_DIR="${SKILL_DIR}/prompts"
RUNTIME_DIR="$(cd -P -- "${SCRIPT_DIR}/../../../runtime" >/dev/null 2>&1 && builtin pwd -P)"
# shellcheck source=../../../runtime/bash-common.sh
source "${RUNTIME_DIR}/bash-common.sh"

timestamp() {
  trusted_date +"%Y%m%d-%H%M%S"
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

NOVA_WORKSPACE_ROOT=""
NOVA_SAFE_PATH=""
TRUSTED_GIT_BIN=""
TRUSTED_GIT_IDENTITY=""
TRUSTED_CAT_BIN=""
TRUSTED_CAT_IDENTITY=""
TRUSTED_MV_BIN=""
TRUSTED_MV_IDENTITY=""
TRUSTED_RM_BIN=""
TRUSTED_RM_IDENTITY=""
TRUSTED_GREP_BIN=""
TRUSTED_GREP_IDENTITY=""
TRUSTED_NODE_BIN=""
TRUSTED_NODE_IDENTITY=""

ensure_trusted_stat() {
  if [[ -n "${NOVA_TRUSTED_STAT_BIN:-}" ]]; then
    return 0
  fi
  NOVA_TRUSTED_STAT_BIN="$(nova_system_command stat)" || die "未找到受信任的系统 stat。"
  case "${OSTYPE:-}" in
    darwin*) NOVA_STAT_STYLE=bsd ;;
    linux*|msys*|cygwin*) NOVA_STAT_STYLE=gnu ;;
    *) NOVA_STAT_STYLE="" ;;
  esac
  export NOVA_TRUSTED_STAT_BIN NOVA_STAT_STYLE
}

ensure_trusted_git() {
  local candidate=""
  ensure_trusted_stat
  if [[ -n "$TRUSTED_GIT_BIN" ]]; then
    return 0
  fi
  candidate="$(nova_system_command git)" || die "未找到受信任的系统 Git。"
  TRUSTED_GIT_IDENTITY="$(nova_executable_identity "$candidate")" \
    || die "无法记录 Git 可执行文件身份: ${candidate}"
  TRUSTED_GIT_BIN="$candidate"
}

trusted_git() {
  local status=0
  ensure_trusted_git
  nova_executable_identity_matches "$TRUSTED_GIT_BIN" "$TRUSTED_GIT_IDENTITY" \
    || die "Git 可执行文件身份在运行前发生变化: ${TRUSTED_GIT_BIN}"
  (
    unset GIT_CONFIG GIT_CONFIG_COUNT GIT_CONFIG_PARAMETERS
    unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES
    unset GIT_EXTERNAL_DIFF GIT_DIFF_OPTS GIT_PAGER PAGER GIT_EDITOR VISUAL EDITOR
    unset GIT_ASKPASS SSH_ASKPASS GIT_SSH GIT_SSH_COMMAND
    export GIT_CONFIG_NOSYSTEM=1
    export GIT_CONFIG_SYSTEM=/dev/null
    export GIT_CONFIG_GLOBAL=/dev/null
    export GIT_TERMINAL_PROMPT=0
    export GIT_OPTIONAL_LOCKS=0
    export GIT_PAGER=
    PATH="${NOVA_SAFE_PATH:-$PATH}" "$TRUSTED_GIT_BIN" \
      -c core.fsmonitor=false \
      -c core.hooksPath=/dev/null \
      -c core.pager= \
      -c interactive.diffFilter= \
      "$@"
  ) || status=$?
  nova_executable_identity_matches "$TRUSTED_GIT_BIN" "$TRUSTED_GIT_IDENTITY" \
    || die "Git 可执行文件身份在运行后发生变化: ${TRUSTED_GIT_BIN}"
  return "$status"
}

trusted_system_invoke() {
  local name="$1"
  shift
  local executable=""
  local identity=""
  local status=0
  ensure_trusted_stat
  case "$name" in
    cat)
      if [[ -z "$TRUSTED_CAT_BIN" ]]; then
        TRUSTED_CAT_BIN="$(nova_system_command cat)" || die "未找到受信任的系统命令: cat"
        TRUSTED_CAT_IDENTITY="$(nova_executable_identity "$TRUSTED_CAT_BIN")" || die "无法记录系统命令身份: ${TRUSTED_CAT_BIN}"
      fi
      executable="$TRUSTED_CAT_BIN"
      identity="$TRUSTED_CAT_IDENTITY"
      ;;
    mv)
      if [[ -z "$TRUSTED_MV_BIN" ]]; then
        TRUSTED_MV_BIN="$(nova_system_command mv)" || die "未找到受信任的系统命令: mv"
        TRUSTED_MV_IDENTITY="$(nova_executable_identity "$TRUSTED_MV_BIN")" || die "无法记录系统命令身份: ${TRUSTED_MV_BIN}"
      fi
      executable="$TRUSTED_MV_BIN"
      identity="$TRUSTED_MV_IDENTITY"
      ;;
    rm)
      if [[ -z "$TRUSTED_RM_BIN" ]]; then
        TRUSTED_RM_BIN="$(nova_system_command rm)" || die "未找到受信任的系统命令: rm"
        TRUSTED_RM_IDENTITY="$(nova_executable_identity "$TRUSTED_RM_BIN")" || die "无法记录系统命令身份: ${TRUSTED_RM_BIN}"
      fi
      executable="$TRUSTED_RM_BIN"
      identity="$TRUSTED_RM_IDENTITY"
      ;;
    grep)
      if [[ -z "$TRUSTED_GREP_BIN" ]]; then
        TRUSTED_GREP_BIN="$(nova_system_command grep)" || die "未找到受信任的系统命令: grep"
        TRUSTED_GREP_IDENTITY="$(nova_executable_identity "$TRUSTED_GREP_BIN")" || die "无法记录系统命令身份: ${TRUSTED_GREP_BIN}"
      fi
      executable="$TRUSTED_GREP_BIN"
      identity="$TRUSTED_GREP_IDENTITY"
      ;;
    mkdir|date|uname|sort|find|bash)
      executable="$(nova_system_command "$name")" || die "未找到受信任的系统命令: ${name}"
      identity="$(nova_executable_identity "$executable")" || die "无法记录系统命令身份: ${executable}"
      ;;
    *) die "不支持的受信任系统命令: ${name}" ;;
  esac
  nova_executable_identity_matches "$executable" "$identity" \
    || die "系统命令身份在执行前发生变化: ${executable}"
  PATH="${NOVA_SAFE_PATH:-$PATH}" "$executable" "$@" || status=$?
  nova_executable_identity_matches "$executable" "$identity" \
    || die "系统命令身份在执行期间发生变化: ${executable}"
  return "$status"
}

trusted_cat() {
  trusted_system_invoke cat "$@"
}

trusted_mv() {
  trusted_system_invoke mv "$@"
}

trusted_rm() {
  trusted_system_invoke rm "$@"
}

trusted_grep() {
  trusted_system_invoke grep "$@"
}

trusted_mkdir() { trusted_system_invoke mkdir "$@"; }
trusted_date() { trusted_system_invoke date "$@"; }
trusted_uname() { trusted_system_invoke uname "$@"; }
trusted_sort() { trusted_system_invoke sort "$@"; }
trusted_find() { trusted_system_invoke find "$@"; }
trusted_bash() { trusted_system_invoke bash "$@"; }

require_command() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "未找到命令: ${cmd}"
}

path_dirname() {
  local path="${1%/}"
  local dir=""
  case "$path" in
    */*)
      dir="${path%/*}"
      [[ -n "$dir" ]] || dir="/"
      printf '%s\n' "$dir"
      ;;
    *) printf '.\n' ;;
  esac
}

path_basename() {
  local path="${1%/}"
  printf '%s\n' "${path##*/}"
}

ensure_git_repo() {
  local root=""
  ensure_trusted_git
  root="$(trusted_git rev-parse --show-toplevel 2>/dev/null)" || die "当前目录不是 Git 仓库。"
  NOVA_WORKSPACE_ROOT="$(cd -P -- "$root" >/dev/null 2>&1 && builtin pwd -P)" \
    || die "无法解析 Git 仓库物理路径。"
  NOVA_SAFE_PATH="$(nova_physical_safe_path "$NOVA_WORKSPACE_ROOT")" \
    || die "PATH 包含空、相对或工作区内组件，拒绝继续。"
  PATH="$NOVA_SAFE_PATH"
  export PATH
  if trusted_git config --get-regexp '^filter\..*\.(clean|smudge|process)$' >/dev/null 2>&1; then
    die "仓库 Git 配置包含可执行 filter helper，拒绝继续。"
  fi
}

repo_root() {
  local root=""
  if [[ -n "$NOVA_WORKSPACE_ROOT" ]]; then
    printf '%s\n' "$NOVA_WORKSPACE_ROOT"
    return 0
  fi
  ensure_trusted_git
  root="$(trusted_git rev-parse --show-toplevel)" || return 1
  cd -P -- "$root" >/dev/null 2>&1 && builtin pwd -P
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
    /*|[A-Za-z]:/*)
      printf '%s\n' "$input"
      return 0
      ;;
  esac

  if resolved_dir="$(cd "$(path_dirname "$input")" 2>/dev/null && pwd)"; then
    printf '%s\n' "${resolved_dir}/$(path_basename "$input")"
    return 0
  fi

  root="$(repo_root)"
  candidate="${root}/${input}"
  if candidate_dir="$(cd "$(path_dirname "$candidate")" 2>/dev/null && pwd)"; then
    printf '%s\n' "${candidate_dir}/$(path_basename "$candidate")"
    return 0
  fi

  die "无法解析路径: ${input}"
}

resolve_output_path() {
  local input="$1"
  local root=""
  local artifact_root=""
  local candidate=""

  root="$(cd "$(repo_root)" >/dev/null 2>&1 && pwd -P)"
  artifact_root="${root}/.codex/codex-review-fix"
  case "$input" in
    *\\*|*//*|*/./*|*/../*|./*|../*|*/.|*/..)
      die "输出路径必须是 .codex/codex-review-fix 下无歧义的路径: ${input}"
      ;;
    /*|[A-Za-z]:/*)
      candidate="$input"
      ;;
    .codex/codex-review-fix/*)
      candidate="${root}/${input}"
      ;;
    *)
      die "输出路径必须位于 ${artifact_root} 下: ${input}"
      ;;
  esac
  case "$candidate" in
    "${artifact_root}"/*)
      local suffix="${candidate#"${artifact_root}/"}"
      case "$suffix" in
        ''|*[!A-Za-z0-9._/-]*)
          die "输出路径只能使用保守的 ASCII 路径组件: ${input}"
          ;;
      esac
      printf '%s\n' "$candidate"
      ;;
    *)
      die "输出路径必须位于 ${artifact_root} 下: ${input}"
      ;;
  esac
}

canonicalize_dir() {
  local dir="$1"
  cd "$dir" >/dev/null 2>&1 || die "无法解析目录: ${dir}"
  pwd
}

detect_default_base_branch() {
  local branch=""

  if branch="$(trusted_git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null)"; then
    printf '%s\n' "$branch"
    return 0
  fi

  for candidate in main master trunk develop; do
    if trusted_git show-ref --verify --quiet "refs/heads/${candidate}"; then
      printf '%s\n' "$candidate"
      return 0
    fi
    if trusted_git show-ref --verify --quiet "refs/remotes/origin/${candidate}"; then
      printf '%s\n' "origin/${candidate}"
      return 0
    fi
  done

  die "无法识别默认基线分支，请通过 --base 显式指定。"
}

ensure_output_dir() {
  local dir="$1"
  local resolved=""
  local root=""
  local artifact_root=""
  local suffix=""
  local current=""
  local component=""
  local -a components=()

  resolved="$(resolve_output_path "${dir%/}/.nova-directory-lease")"
  resolved="$(path_dirname "$resolved")"
  root="$(cd "$(repo_root)" >/dev/null 2>&1 && pwd -P)"
  artifact_root="${root}/.codex/codex-review-fix"
  suffix="${resolved#"${root}/"}"
  current="$root"
  IFS='/' read -r -a components <<< "$suffix"
  for component in "${components[@]}"; do
    current="${current}/${component}"
    [[ ! -L "$current" ]] || die "输出目录组件不能是符号链接: ${current}"
    if [[ -e "$current" ]]; then
      [[ -d "$current" ]] || die "输出目录组件不是目录: ${current}"
    else
      trusted_mkdir "$current" || die "无法创建输出目录: ${current}"
    fi
  done
  [[ "$(cd "$resolved" >/dev/null 2>&1 && pwd -P)" == "$resolved" ]] \
    || die "输出目录物理路径逃逸 ${artifact_root}: ${resolved}"
  printf '%s\n' "$resolved"
}

output_file_link_count() {
  local output="$1"
  ensure_trusted_stat
  nova_file_link_count "$output" 2>/dev/null || true
}

output_file_identity() {
  local output="$1"
  local identity=""
  local remainder=""
  ensure_trusted_stat
  identity="$(nova_file_identity "$output" 2>/dev/null || true)"
  [[ -n "$identity" ]] || return 0
  remainder="${identity#*:}"
  printf '%s:%s\n' "${identity%%:*}" "${remainder%%:*}"
}

output_file_inode() {
  local output="$1"
  local identity=""
  local remainder=""
  ensure_trusted_stat
  identity="$(nova_file_identity "$output" 2>/dev/null || true)"
  [[ -n "$identity" ]] || return 0
  remainder="${identity#*:}"
  printf '%s\n' "${remainder%%:*}"
}

held_output_fd_path() {
  if [[ -e /dev/fd/9 ]]; then
    printf '%s\n' /dev/fd/9
  elif [[ -e /proc/self/fd/9 ]]; then
    printf '%s\n' /proc/self/fd/9
  else
    return 1
  fi
}

prepare_output_file() {
  local input="$1"
  local output=""
  local parent=""
  local links=""

  output="$(resolve_output_path "$input")"
  parent="$(ensure_output_dir "$(path_dirname "$output")")"
  output="${parent}/$(path_basename "$output")"
  [[ ! -L "$output" ]] || die "输出文件不能是符号链接: ${output}"
  if [[ -e "$output" ]]; then
    [[ -f "$output" ]] || die "输出目标必须是普通文件: ${output}"
    links="$(output_file_link_count "$output")"
    [[ "$links" == "1" ]] || die "输出文件不能是硬链接或无法验证链接数: ${output}"
  fi
  printf '%s\n' "$output"
}

# 所有 shell 产物通过同目录独占临时文件和固定 FD 9 写入。调用方必须在
# begin_output_file 后只写 >&9，并以 finish_output_file 原子发布。这样即使
# 最终路径在写入期间被替换为符号链接，也不会跟随该链接写入其目标。
ACTIVE_OUTPUT_FINAL=""
ACTIVE_OUTPUT_STAGING=""
ACTIVE_OUTPUT_IDENTITY=""
ACTIVE_OUTPUT_FD_INODE=""

abort_active_output() {
  if [[ -n "${ACTIVE_OUTPUT_STAGING:-}" ]]; then
    exec 9>&- 2>/dev/null || true
    trusted_rm -f "${ACTIVE_OUTPUT_STAGING}" 2>/dev/null || true
  fi
  ACTIVE_OUTPUT_FINAL=""
  ACTIVE_OUTPUT_STAGING=""
  ACTIVE_OUTPUT_IDENTITY=""
  ACTIVE_OUTPUT_FD_INODE=""
}

begin_output_file() {
  local input="$1"
  local output=""
  local parent=""
  local basename=""
  local staging=""
  local attempt=0
  local opened=false
  local restore_noclobber=false
  local fd_path=""
  local fd_inode=""

  [[ -z "${ACTIVE_OUTPUT_STAGING:-}" ]] || die "已有未完成的原子输出文件: ${ACTIVE_OUTPUT_FINAL}"
  output="$(prepare_output_file "$input")"
  parent="$(ensure_output_dir "$(path_dirname "$output")")"
  output="${parent}/$(path_basename "$output")"
  basename="$(path_basename "$output")"

  while [[ "$attempt" -lt 32 ]]; do
    attempt=$((attempt + 1))
    staging="${parent}/.${basename}.nova-tmp.$$.$RANDOM.$RANDOM"
    [[ ! -e "$staging" && ! -L "$staging" ]] || continue
    [[ -o noclobber ]] && restore_noclobber=true
    set -o noclobber
    if exec 9> "$staging"; then
      opened=true
    fi
    [[ "$restore_noclobber" == true ]] || set +o noclobber
    [[ "$opened" == true ]] && break
  done
  [[ "$opened" == true ]] || die "无法独占创建原子输出临时文件: ${output}"

  fd_path="$(held_output_fd_path || true)"
  [[ -n "$fd_path" ]] || {
    exec 9>&- 2>/dev/null || true
    trusted_rm -f "$staging" 2>/dev/null || true
    die "当前 Bash 环境无法验证持有的输出文件描述符。"
  }
  fd_inode="$(output_file_inode "$fd_path")"
  [[ -n "$fd_inode" && "$(output_file_link_count "$fd_path")" == "1" ]] || {
    exec 9>&- 2>/dev/null || true
    trusted_rm -f "$staging" 2>/dev/null || true
    die "无法验证持有的原子输出文件描述符: ${staging}"
  }

  [[ ! -L "$staging" && -f "$staging" ]] || {
    exec 9>&- 2>/dev/null || true
    trusted_rm -f "$staging" 2>/dev/null || true
    die "原子输出临时文件类型无效: ${staging}"
  }
  [[ "$(output_file_link_count "$staging")" == "1" ]] || {
    exec 9>&- 2>/dev/null || true
    trusted_rm -f "$staging" 2>/dev/null || true
    die "原子输出临时文件链接数无效: ${staging}"
  }
  [[ "$(output_file_inode "$staging")" == "$fd_inode" ]] || {
    exec 9>&- 2>/dev/null || true
    trusted_rm -f "$staging" 2>/dev/null || true
    die "原子输出临时路径与持有文件描述符身份不一致: ${staging}"
  }

  ACTIVE_OUTPUT_FINAL="$output"
  ACTIVE_OUTPUT_STAGING="$staging"
  ACTIVE_OUTPUT_IDENTITY="$(output_file_identity "$staging")"
  ACTIVE_OUTPUT_FD_INODE="$fd_inode"
  [[ -n "$ACTIVE_OUTPUT_IDENTITY" ]] || {
    abort_active_output
    die "无法记录原子输出临时文件身份: ${staging}"
  }
}

finish_output_file() {
  local output="${ACTIVE_OUTPUT_FINAL:-}"
  local staging="${ACTIVE_OUTPUT_STAGING:-}"
  local identity="${ACTIVE_OUTPUT_IDENTITY:-}"
  local fd_inode="${ACTIVE_OUTPUT_FD_INODE:-}"
  local revalidated=""
  local fd_path=""

  [[ -n "$output" && -n "$staging" && -n "$identity" && -n "$fd_inode" ]] || die "没有可发布的原子输出文件。"
  fd_path="$(held_output_fd_path || true)"
  [[ -n "$fd_path" \
    && "$(output_file_inode "$fd_path")" == "$fd_inode" \
    && "$(output_file_link_count "$fd_path")" == "1" ]] || {
    abort_active_output
    die "持有的原子输出文件描述符在发布前发生变化: ${staging}"
  }

  [[ ! -L "$staging" && -f "$staging" ]] || {
    abort_active_output
    die "原子输出临时文件在发布前被替换: ${staging}"
  }
  [[ "$(output_file_link_count "$staging")" == "1" ]] || {
    abort_active_output
    die "原子输出临时文件在发布前出现硬链接: ${staging}"
  }
  [[ "$(output_file_identity "$staging")" == "$identity" ]] || {
    abort_active_output
    die "原子输出临时文件身份在发布前发生变化: ${staging}"
  }
  [[ "$(output_file_inode "$staging")" == "$fd_inode" ]] || {
    abort_active_output
    die "原子输出临时路径与持有文件描述符在发布前不一致: ${staging}"
  }

  exec 9>&-
  [[ ! -L "$staging" && -f "$staging" \
    && "$(output_file_link_count "$staging")" == "1" \
    && "$(output_file_identity "$staging")" == "$identity" \
    && "$(output_file_inode "$staging")" == "$fd_inode" ]] || {
    abort_active_output
    die "原子输出临时文件在关闭描述符后发生变化: ${staging}"
  }

  revalidated="$(prepare_output_file "$output")"
  [[ "$revalidated" == "$output" ]] || {
    abort_active_output
    die "原子输出目标在发布前发生变化: ${output}"
  }
  trusted_mv -f "$staging" "$output" || {
    abort_active_output
    die "无法原子发布输出文件: ${output}"
  }
  ACTIVE_OUTPUT_STAGING=""
  [[ ! -L "$output" && -f "$output" ]] \
    || die "原子输出文件发布后类型无效: ${output}"
  [[ "$(output_file_link_count "$output")" == "1" ]] \
    || die "原子输出文件发布后链接数无效: ${output}"
  [[ "$(output_file_identity "$output")" == "$identity" ]] \
    || die "原子输出文件发布后身份不一致: ${output}"
  ACTIVE_OUTPUT_FINAL=""
  ACTIVE_OUTPUT_IDENTITY=""
  ACTIVE_OUTPUT_FD_INODE=""
}

atomic_copy_output_file() {
  local source="$1"
  local output="$2"
  [[ -f "$source" ]] || die "待复制的输出源文件不存在: ${source}"
  begin_output_file "$output"
  if ! trusted_cat "$source" >&9; then
    abort_active_output
    die "无法复制输出文件: ${source}"
  fi
  finish_output_file
}

default_output_dir() {
  local root
  root="$(cd "$(repo_root)" >/dev/null 2>&1 && pwd -P)"
  printf '%s\n' "${root}/.codex/codex-review-fix/$(timestamp)"
}

prepare_temp_dir() {
  local parent="$1"
  local dir
  dir="${parent}/tmp.$(timestamp)"
  trusted_mkdir -p "$dir"
  printf '%s\n' "$dir"
}

prompt_file() {
  local name="$1"
  local file="${PROMPTS_DIR}/${name}"
  [[ -f "$file" ]] || die "未找到 prompt 模板: ${file}"
  printf '%s\n' "$file"
}

CODEX_LAUNCH_KIND=""
CODEX_BIN=""
CODEX_SCRIPT=""
CODEX_LAUNCH_PATH=""
CODEX_BIN_IDENTITY=""
CODEX_SCRIPT_IDENTITY=""
CODEX_VERSION_LINE=""

codex_launcher_identity_valid() {
  [[ -n "$CODEX_BIN" && -n "$CODEX_BIN_IDENTITY" ]] || return 1
  nova_executable_identity_matches "$CODEX_BIN" "$CODEX_BIN_IDENTITY" || return 1
  if [[ "$CODEX_LAUNCH_KIND" == node-script ]]; then
    [[ -n "$CODEX_SCRIPT" && -n "$CODEX_SCRIPT_IDENTITY" ]] || return 1
    nova_executable_identity_matches "$CODEX_SCRIPT" "$CODEX_SCRIPT_IDENTITY" || return 1
  fi
}

invoke_resolved_codex() {
  local status=0
  codex_launcher_identity_valid || {
    error "Codex launcher 身份在执行前发生变化。"
    return 126
  }
  if [[ "$CODEX_LAUNCH_KIND" == node-script ]]; then
    PATH="$NOVA_SAFE_PATH" "$CODEX_BIN" "$CODEX_SCRIPT" "$@" || status=$?
  else
    PATH="$NOVA_SAFE_PATH" "$CODEX_BIN" "$@" || status=$?
  fi
  codex_launcher_identity_valid || {
    error "Codex launcher 身份在执行后发生变化。"
    return 126
  }
  return "$status"
}

unset_probe_credentials() {
  local name=""
  while IFS= read -r name; do
    case "$name" in
      *_TOKEN|*_TOKEN_*|TOKEN_*|*_SECRET|*_SECRET_*|SECRET_*|*_PASSWORD|*_PASSWORD_*|PASSWORD_*|*_PASSWD|*_API_KEY|*_ACCESS_KEY|*_PRIVATE_KEY|*_CREDENTIAL|*_CREDENTIALS|SSH_AUTH_SOCK)
        unset "$name" 2>/dev/null || true
        ;;
    esac
  done < <(builtin compgen -A variable)
}

resolve_codex_launcher() {
  local candidate_name=""
  local candidate_from_path=""
  local candidate_entry=""
  local candidate_physical=""
  local candidate_identity=""
  local first_line=""
  local node_bin=""
  local node_identity=""
  local output=""
  local status=0
  local first=""

  [[ -n "$NOVA_WORKSPACE_ROOT" ]] || ensure_git_repo
  [[ -n "$NOVA_SAFE_PATH" ]] || NOVA_SAFE_PATH="$(nova_physical_safe_path "$NOVA_WORKSPACE_ROOT")" \
    || return 1

  for candidate_name in codex codex.exe; do
    candidate_from_path="$(PATH="$NOVA_SAFE_PATH" type -P "$candidate_name" 2>/dev/null || true)"
    [[ -n "$candidate_from_path" ]] || continue
    candidate_entry="$(nova_canonical_path_entry "$candidate_from_path")" || continue
    candidate_physical="$(nova_physical_executable_path "$candidate_entry")" || continue
    if nova_path_is_within "$NOVA_WORKSPACE_ROOT" "$candidate_entry" \
      || nova_path_is_within "$NOVA_WORKSPACE_ROOT" "$candidate_physical"; then
      continue
    fi
    candidate_identity="$(nova_executable_identity "$candidate_physical")" || continue

    CODEX_SCRIPT=""
    CODEX_SCRIPT_IDENTITY=""
    if nova_native_executable_format "$candidate_physical"; then
      CODEX_LAUNCH_KIND="native"
      CODEX_BIN="$candidate_physical"
      CODEX_BIN_IDENTITY="$candidate_identity"
      CODEX_LAUNCH_PATH="$candidate_physical"
    else
      IFS= read -r first_line < "$candidate_physical" || continue
      first_line="${first_line%$'\r'}"
      [[ "$first_line" == '#!/usr/bin/env node' ]] || continue
      ensure_trusted_node || continue
      node_bin="$TRUSTED_NODE_BIN"
      node_identity="$TRUSTED_NODE_IDENTITY"
      CODEX_LAUNCH_KIND="node-script"
      CODEX_BIN="$node_bin"
      CODEX_BIN_IDENTITY="$node_identity"
      CODEX_SCRIPT="$candidate_physical"
      CODEX_SCRIPT_IDENTITY="$candidate_identity"
      CODEX_LAUNCH_PATH="$candidate_physical"
    fi

    status=0
    output="$(
      unset_probe_credentials
      invoke_resolved_codex --version 2>&1
    )" || status=$?
    first="$(first_nonempty_line "$output" || true)"
    if [[ "$status" -eq 0 && -n "$first" ]] && ! command_output_looks_unusable "$output"; then
      codex_launcher_identity_valid || return 1
      CODEX_VERSION_LINE="$first"
      return 0
    fi
  done

  CODEX_LAUNCH_KIND=""
  CODEX_BIN=""
  CODEX_SCRIPT=""
  CODEX_LAUNCH_PATH=""
  CODEX_BIN_IDENTITY=""
  CODEX_SCRIPT_IDENTITY=""
  CODEX_VERSION_LINE=""
  return 1
}

ensure_codex_available() {
  if ! resolve_codex_launcher; then
    die "未找到可运行的 codex 命令。请确认 Codex CLI 及其运行时依赖在当前 Bash 环境中可用。"
  fi
}

ensure_trusted_node() {
  local root="${NOVA_WORKSPACE_ROOT:-}"
  [[ -n "$root" ]] || root="$(repo_root)" || return 1
  ensure_trusted_stat
  if [[ -n "$TRUSTED_NODE_BIN" ]]; then
    return 0
  fi
  TRUSTED_NODE_BIN="$(nova_node_command "$root")" || return 1
  TRUSTED_NODE_IDENTITY="$(nova_executable_identity "$TRUSTED_NODE_BIN")" || return 1
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
  ensure_trusted_node || return 1
  printf '%s\n' "$TRUSTED_NODE_BIN"
}

trusted_node_invoke() {
  local node_bin="$1"
  local expected_identity="$2"
  shift 2
  local status=0
  nova_executable_identity_matches "$node_bin" "$expected_identity" || {
    error "Node 可执行文件身份在执行前发生变化: ${node_bin}"
    return 126
  }
  PATH="$NOVA_SAFE_PATH" "$node_bin" "$@" || status=$?
  nova_executable_identity_matches "$node_bin" "$expected_identity" || {
    error "Node 可执行文件身份在执行后发生变化: ${node_bin}"
    return 126
  }
  return "$status"
}

codex_executable() {
  resolve_codex_launcher || return 1
  printf '%s\n' "$CODEX_LAUNCH_PATH"
}

codex_invoke() {
  [[ -n "$CODEX_LAUNCH_KIND" ]] || resolve_codex_launcher || return 127
  invoke_resolved_codex "$@"
}

codex_trusted_version_line() {
  resolve_codex_launcher || return 1
  printf '%s\n' "$CODEX_VERSION_LINE"
}

runtime_environment_lines() {
  local node_cmd=""
  local node_path=""
  local node_version=""
  local codex_cmd=""
  local codex_path=""
  local codex_version=""
  local bash_cmd=""

  node_cmd="$(node_executable 2>/dev/null || true)"
  if [[ -n "$node_cmd" ]]; then
    node_path="$node_cmd"
    node_version="$(trusted_node_invoke "$node_cmd" "$(nova_executable_identity "$node_cmd")" --version 2>/dev/null || printf 'version unavailable\n')"
  else
    node_path="not available"
    node_version="version unavailable"
  fi

  if [[ -n "$CODEX_LAUNCH_KIND" ]]; then
    codex_cmd="$CODEX_LAUNCH_PATH"
    codex_path="$CODEX_LAUNCH_PATH"
    codex_version="$CODEX_VERSION_LINE"
  else
    codex_cmd="not probed"
    codex_path="not probed"
    codex_version="not probed"
  fi

  printf 'timestamp_utc=%s\n' "$(trusted_date -u +"%Y-%m-%dT%H:%M:%SZ")"
  printf 'pwd=%s\n' "$(pwd)"
  printf 'script_dir=%s\n' "${SCRIPT_DIR}"
  printf 'shell=%s\n' "${SHELL:-unknown}"
  printf 'uname=%s\n' "$(trusted_uname -a 2>/dev/null || printf 'not available')"
  ensure_trusted_git
  printf 'git_path=%s\n' "$TRUSTED_GIT_BIN"
  printf 'git_version=%s\n' "$(trusted_git --version 2>/dev/null || printf 'version unavailable\n')"
  bash_cmd="$(nova_system_command bash 2>/dev/null || true)"
  printf 'bash_path=%s\n' "${bash_cmd:-not available}"
  if [[ -n "$bash_cmd" ]]; then
    printf 'bash_version=%s\n' "$(command_version_line "$bash_cmd" --version)"
  else
    printf 'bash_version=version unavailable\n'
  fi
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
  begin_output_file "$output_file"
  if ! runtime_environment_lines >&9; then
    abort_active_output
    die "无法写入运行环境文件: ${output_file}"
  fi
  finish_output_file
}

print_runtime_environment() {
  runtime_environment_lines
}

git_has_changes_against_base() {
  local base="$1"
  local merge_base=""
  merge_base="$(trusted_git merge-base "HEAD" "$base" 2>/dev/null || true)"
  [[ -n "$merge_base" ]] || return 1
  ! trusted_git diff --no-ext-diff --no-textconv --quiet "$merge_base"...HEAD
}

git_has_staged_changes() {
  ! trusted_git diff --no-ext-diff --no-textconv --cached --quiet
}

git_has_worktree_changes() {
  ! trusted_git diff --no-ext-diff --no-textconv --quiet \
    || [[ -n "$(trusted_git ls-files --others --exclude-standard)" ]]
}

untracked_content_max_bytes() {
  printf '%s\n' "${CODEX_UNTRACKED_CONTENT_MAX_BYTES:-262144}"
}

untracked_path_is_sensitive() {
  local file="$1"
  local node_bin=""
  local rules_path=""
  local node_rules_path=""
  local node_identity=""

  ensure_trusted_node || return 0
  node_bin="$TRUSTED_NODE_BIN"
  node_identity="$TRUSTED_NODE_IDENTITY"
  rules_path="$(nova_secret_rules_path)"
  [ -f "$rules_path" ] || return 0
  node_rules_path="$(nova_secret_rules_path_for_node "$node_bin")"
  trusted_node_invoke "$node_bin" "$node_identity" "$node_rules_path" sensitive-path "$file"
}

content_has_sensitive_value() {
  local file="$1"
  local node_bin=""
  local rules_path=""
  local node_rules_path=""
  local node_file=""
  local node_identity=""

  ensure_trusted_node || return 0
  node_bin="$TRUSTED_NODE_BIN"
  node_identity="$TRUSTED_NODE_IDENTITY"
  rules_path="$(nova_secret_rules_path)"
  [ -f "$rules_path" ] || return 0
  node_rules_path="$(nova_secret_rules_path_for_node "$node_bin")"
  node_file="$(nova_path_for_node_command "$file" "$node_bin")"
  trusted_node_invoke "$node_bin" "$node_identity" "$node_rules_path" detect-file "$node_file"
}

validate_untracked_content_file() {
  local file="$1"
  local max_bytes=""
  local size_bytes=""
  local identity=""
  local remainder=""

  [[ -f "$file" ]] || return 1

  if untracked_path_is_sensitive "$file"; then
    die "未跟踪文件路径疑似敏感，拒绝写入 review patch: ${file}"
  fi

  if [[ -s "$file" ]] && ! trusted_grep -Iq . "$file"; then
    die "未跟踪文件疑似二进制，拒绝写入 review patch: ${file}"
  fi

  max_bytes="$(untracked_content_max_bytes)"
  ensure_trusted_stat
  identity="$(nova_file_identity "$file")" || die "无法验证未跟踪文件大小: ${file}"
  remainder="${identity#*:}"
  remainder="${remainder#*:}"
  remainder="${remainder#*:}"
  size_bytes="${remainder%%:*}"
  case "$size_bytes" in
    ''|*[!0-9]*) die "无法验证未跟踪文件大小: ${file}" ;;
  esac
  if [[ "$size_bytes" -gt "$max_bytes" ]]; then
    die "未跟踪文件超过 ${max_bytes} bytes，拒绝写入 review patch: ${file}"
  fi

  if content_has_sensitive_value "$file"; then
    die "未跟踪文件疑似包含敏感信息，拒绝写入 review patch: ${file}"
  fi
}

write_untracked_diff_stream() {
  local file=""

  while IFS= read -r -d '' file; do
    [[ -f "$file" ]] || continue
    case "$file" in
      .codex/codex-review-fix/*)
        continue
        ;;
    esac
    validate_untracked_content_file "$file"
    {
      printf '\n### untracked file: %s\n' "$file"
      trusted_git diff --no-ext-diff --no-textconv --no-index --binary -- /dev/null "$file" 2>&1 || true
    }
  done < <(trusted_git ls-files --others --exclude-standard -z)
}

write_untracked_diff() {
  local output_file="$1"
  begin_output_file "$output_file"
  if ! write_untracked_diff_stream >&9; then
    abort_active_output
    die "无法写入未跟踪文件 diff: ${output_file}"
  fi
  finish_output_file
}

write_latest_pointer() {
  local output_dir="$1"
  local root
  local latest_file=""
  root="$(cd "$(repo_root)" >/dev/null 2>&1 && pwd -P)"
  latest_file="$(prepare_output_file "${root}/.codex/codex-review-fix/latest")"
  begin_output_file "$latest_file"
  printf '%s\n' "$output_dir" >&9
  finish_output_file
  ensure_output_dir "${root}/.codex/codex-review-fix/latest-artifacts" >/dev/null
}

codex_exec_args() {
  local working_dir="$1"
  local model="${CODEX_MODEL:-}"
  local profile="${CODEX_PROFILE:-}"

  local -a args
  args=("exec" "-C" "$working_dir" "--sandbox" "read-only" "--skip-git-repo-check" "--color" "never")

  if [[ -n "$profile" ]]; then
    args+=("--profile" "$profile")
  fi
  if [[ -n "$model" ]]; then
    args+=("--model" "$model")
  fi

  printf '%s\n' "${args[@]}"
}

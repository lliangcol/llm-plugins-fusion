---
name: nova-codex-verify-only
description: "Run Codex verification against an existing review.md and the current branch state. Use when Claude Code or a human has already applied fixes and only needs a focused verify pass, merge recommendation, and residual blockers."
license: MIT
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
disable-model-invocation: true
compatibility: "Requires Node.js 22+, Bash 3.2+, an authenticated Codex CLI, and network access; Bash is not pre-approved."
metadata:
  nova-user-invocable: "true"
  nova-model-invocable: "false"
  nova-subagent-safe: "true"
  nova-destructive-actions: "low"
argument-hint: "Example: codex-verify-only REVIEW_FILE=.codex/codex-review-fix/latest-artifacts/review.md CHECKS_FILE=.codex/codex-review-fix/latest-artifacts/checks.txt"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:codex-verify-only` and the deprecated `/nova-plugin:nova-codex-verify-only` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

- Resolve natural-language and explicit `KEY=value` inputs using `../_shared/parameter-resolution.md`; explicit non-conflicting values take precedence.
- Apply `../_shared/safety-preflight.md` before side effects. Never infer approval, destructive scope, credentials, or output destinations.
- Follow `../_shared/output-contracts.md` and `../_shared/artifact-policy.md`; report completed, skipped, and blocked validation truthfully.
- Respect the frontmatter tool boundary. Missing inputs, unavailable dependencies, overlapping user changes, or repository-policy conflicts are blockers rather than permission to broaden scope.

## Execution

1. Parse `$ARGUMENTS` against the workflow-specific inputs below.
2. Read only the context required for the requested scope.
3. Apply the workflow contract and its strict output format.
4. Stop before unauthorized side effects; otherwise validate in proportion to risk and report residual risk.

## Workflow Contract

### 目的

基于已有 `review.md` 做定向 verify。

### 使用方式

1. 确认上一轮 `review.md` 路径
2. 如有本地 checks 输出，一并提供 `CHECKS_FILE`
3. 先确认 `CLAUDE_PLUGIN_ROOT` 可用，然后调用 `${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh --review-file <path>`
4. 阅读 `verify.md`，确认已解决、未解决和剩余阻塞项
5. 同步查看 `verify.runtime-environment.txt`，核对执行目录、脚本目录、Git/Bash/Node/Codex 路径和版本

### 适用场景

- 修复完成后做复验
- 多轮修复后判断是否可合并
- 只想验证已知问题，而不是重新做开放式审查

### 安全边界

- 不做新实现
- 允许写 `.codex` verify artifact，不允许修改项目代码
- 只在高置信时报告新增高风险问题
- 重点验证上一轮 review 项是否关闭

## Detailed Contract

### CODEX VERIFY ONLY

你是 Claude Code，但本命令只负责编排 Codex verify，不做新的实现修改。

---

#### 输入要求

从 `$ARGUMENTS` 中提取：

- `REVIEW_FILE`：必填，上一轮 `review.md`
- `CHECKS_FILE`：可选，本地 checks 输出文件
- `BASE`：可选，默认自动识别
- `OUTPUT_DIR`：可选，verify artifact 输出目录
- `INCLUDE_UNTRACKED_CONTENT`：可选，默认为 false；只在显式为 true 时允许未跟踪文件内容进入 verify patch

如果缺少 `REVIEW_FILE`，必须停止并要求补充。

---

#### 执行要求

先确认 `CLAUDE_PLUGIN_ROOT` 可用；如果不可用，必须停止并提示插件未正确启用。

1. 运行：
   `bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh" --review-file <REVIEW_FILE>`
2. 如有 `BASE`，追加 `--base <BASE>`
3. 如有 `CHECKS_FILE`，追加 `--checks-file <CHECKS_FILE>`
4. 如有 `OUTPUT_DIR`，追加 `--output-dir <OUTPUT_DIR>`
5. 仅当 `INCLUDE_UNTRACKED_CONTENT=true` 时追加 `--include-untracked-content`
6. 输出 verify 文件路径与结论摘要

---

#### 你必须

- 聚焦 verify，不重新做实现
- 明确说明已解决 / 未解决 / 不确定 / 新增高风险问题
- 输出是否建议合并

#### 你不得

- 写业务代码
- 跳过 `review.md` 直接做开放式 review

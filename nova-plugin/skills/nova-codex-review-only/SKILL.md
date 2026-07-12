---
name: nova-codex-review-only
description: Run Codex-only branch review with external scripts and structured review artifacts. Use when Claude Code should collect current branch diff context and ask Codex to produce a high-confidence review report without modifying code.
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
argument-hint: "Example: codex-review-only BASE=main"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:codex-review-only` and the deprecated `/nova-plugin:nova-codex-review-only` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

<!-- BEGIN GENERATED BEHAVIOR CONTRACT -->
> Generated from `workflow-specs/behaviors.json`. This block is authoritative. Run `node scripts/generate-behavior-surfaces.mjs --write` after changing the IR; if explanatory text below conflicts, fail closed.

### Generated Behavior Index

- **Purpose:** Produce an external Codex review artifact without modifying project code.
- **Canonical inputs:** `REVIEW_SCOPE`(required aliases=INPUT,SCOPE); `BASE`(optional aliases=BASE_BRANCH); `REVIEW_MODE`(optional aliases=MODE default="branch" exact="branch","staged","full")
- **Decision entries:** 3.
- **Workflow steps:** `resolve-scope` → `run-review` → `retain-evidence` → `summarize`
- **Output:** mode=`artifact`; order=`review artifact` → `runtime evidence` → `scope summary`; severity=`must-fix`, `should-fix`, `ignorable`.
- **Deviation/failure:** mode=`forbid`; failure order=`status` → `blocker` → `review scope` → `safe next action`.
- **Full IR:** `runtime/contracts/codex-review-only.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### 目的

只运行 Codex review，不修改代码。

### 使用方式

1. 先确认 `CLAUDE_PLUGIN_ROOT` 可用，然后调用 `${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-review.sh`
2. 默认审查当前分支相对 base 的差异
3. 输出 `review.md` 给后续人工或 Claude Code 消费
4. 同步输出 `runtime-environment.txt`，记录执行目录、脚本目录、Git/Bash/Node/Codex 路径和版本

### 适用场景

- 提交前快速生成 review 报告
- 把 review 和 fix 分成两个独立阶段
- 需要先看 Codex 结论，再决定是否进入修复闭环

### 安全边界

- 不写代码
- 允许写 `.codex` review artifact，不允许修改项目代码
- 不扩大审查范围
- 对低置信问题保持克制

## Detailed Contract

### CODEX REVIEW ONLY

你是 Claude Code，但本命令只负责编排 Codex review，不做实现修改。

---

#### 执行要求

先确认 `CLAUDE_PLUGIN_ROOT` 可用；如果不可用，必须停止并提示插件未正确启用。

1. 运行：
   `bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-review.sh"`
2. 按参数决定是否追加 `--base`、`--only-staged`、`--full`
3. 输出 review 文件路径与简短摘要

---

#### 你必须

- 只做 review，不修改代码
- 明确 review 范围
- 提醒用户查看 `review.md`

#### 你不得

- 写业务代码
- 自行进入 fix 流程
- 把 review 结论包装成已验证事实

---
name: nova-codex-review-only
description: Run Codex-only branch review with external scripts and structured review artifacts. Use when Claude Code should collect current branch diff context and ask Codex to produce a high-confidence review report without modifying code.
license: MIT
allowed-tools: Bash Read Glob Grep LS
argument-hint: "Example: codex-review-only BASE=main"
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: true
    destructiveActions: none
---

## Inputs

| Parameter | Required | Default | Notes |
| --- | --- | --- | --- |
| `REVIEW_MODE` | No | branch | Review scope: branch, staged, or full. Maps to default, --only-staged, or --full. |
| `BASE` | No | Auto-detect | Baseline branch passed as --base. |
| `OUTPUT_DIR` | No | Script default | Review artifact directory passed as --output-dir. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words to `REVIEW_MODE`; do not pass unsupported free-form payload to scripts.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; probe Git status, base branches, and latest artifacts only for context parameters.
- Safety-boundary parameters for this skill: none for this skill.
- In non-interactive mode, fail before side effects when required or safety-boundary parameters are missing.
- Full policy: `nova-plugin/skills/_shared/parameter-resolution.md`.

## Safety Preflight

- This skill declares side-effect-capable tools: `Bash`.
- Resolve parameters and present a preflight card before writing artifacts, editing project files, or running Bash.
- Show files or artifacts that may be written, scripts or commands that may run, disallowed operations, and the proceed condition.
- Do not infer missing safety-boundary values; ask once in interactive mode or fail in non-interactive mode.
- Preserve repository constraints: no destructive Git cleanup, no branch deletion, no push/merge/rebase, no editing archived agents as active agents.
- Full policy: `nova-plugin/skills/_shared/safety-preflight.md`.

## Codex Script Argument Mapping

- `REVIEW_MODE=branch` runs `codex-review.sh` without scope flags.
- `REVIEW_MODE=staged` adds `--only-staged`; `REVIEW_MODE=full` adds `--full`.
- `BASE` is passed as `--base <BASE>`.
- `OUTPUT_DIR`, when provided, is passed as `--output-dir <OUTPUT_DIR>`.
- Do not pass unsupported free-form payload to the script.

## Outputs

- Follow the skill-specific output rules below and the shared output contract.
- For written artifacts, report the path and a short executive summary instead of pasting the full artifact into chat.
- For reviews and verification, lead with findings or verdicts and state residual risk.
- Full policy: `nova-plugin/skills/_shared/output-contracts.md`.
- Artifact policy: `nova-plugin/skills/_shared/artifact-policy.md`.

## Workflow

1. Resolve parameters using the shared policy and this skill's input table.
2. Read only the context needed for the requested scope.
3. Apply the skill-specific guidance and migrated slash command contract below.
4. Respect safety preflight before any side effects.
5. Produce the required output and report validation or skipped validation honestly.

## Failure Modes

- Required payload is missing or ambiguous.
- A safety-boundary parameter is missing, conflicting, or unsafe to infer.
- Required files, scripts, CLIs, credentials, or runtime dependencies are unavailable.
- Existing user changes overlap the intended write scope and cannot be merged safely.
- Repository policy conflicts with the requested action.

## Examples

- Use `/codex-review-only` for the review step only.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### 目的

只运行 Codex review，不修改代码。

### 使用方式

1. 先确认 `CLAUDE_PLUGIN_ROOT` 可用，然后调用 `${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-review.sh`
2. 默认审查当前分支相对 base 的差异
3. 输出 `review.md` 给后续人工或 Claude Code 消费

### 适用场景

- 提交前快速生成 review 报告
- 把 review 和 fix 分成两个独立阶段
- 需要先看 Codex 结论，再决定是否进入修复闭环

### 安全边界

- 不写代码
- 不扩大审查范围
- 对低置信问题保持克制

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/codex-review-only` (`nova-plugin/commands/codex-review-only.md`).

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

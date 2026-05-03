---
name: nova-codex-verify-only
description: "Run Codex verification against an existing review.md and the current branch state. Use when Claude Code or a human has already applied fixes and only needs a focused verify pass, merge recommendation, and residual blockers."
license: MIT
allowed-tools: Bash Read Glob Grep LS
argument-hint: "Example: codex-verify-only REVIEW_FILE=.codex/codex-review-fix/latest-artifacts/review.md CHECKS_FILE=.codex/codex-review-fix/latest-artifacts/checks.txt"
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
| `REVIEW_FILE` | Yes | None | Safety-boundary path to the existing review.md passed as --review-file. |
| `CHECKS_FILE` | No | Auto-detect when safe | Local checks output passed as --checks-file when provided. |
| `BASE` | No | Auto-detect | Baseline branch passed as --base. |
| `OUTPUT_DIR` | No | Review directory | Verification artifact directory passed as --output-dir. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to `REVIEW_FILE`.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; probe Git status, base branches, and latest artifacts only for context parameters.
- Safety-boundary parameters for this skill: `REVIEW_FILE`.
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

- `REVIEW_FILE` is required and passed as `--review-file <REVIEW_FILE>`.
- `CHECKS_FILE`, when provided, is passed as `--checks-file <CHECKS_FILE>`.
- `BASE`, when provided, is passed as `--base <BASE>`.
- `OUTPUT_DIR`, when provided, is passed as `--output-dir <OUTPUT_DIR>`.
- Do not run open-ended review or implementation from this verify-only entry.

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

- Use `/codex-verify-only` for verify against an existing review file.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### 目的

基于已有 `review.md` 做定向 verify。

### 使用方式

1. 确认上一轮 `review.md` 路径
2. 如有本地 checks 输出，一并提供 `CHECKS_FILE`
3. 先确认 `CLAUDE_PLUGIN_ROOT` 可用，然后调用 `${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh --review-file <path>`
4. 阅读 `verify.md`，确认已解决、未解决和剩余阻塞项

### 适用场景

- 修复完成后做复验
- 多轮修复后判断是否可合并
- 只想验证已知问题，而不是重新做开放式审查

### 安全边界

- 不做新实现
- 只在高置信时报告新增高风险问题
- 重点验证上一轮 review 项是否关闭

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/codex-verify-only` (`nova-plugin/commands/codex-verify-only.md`).

### CODEX VERIFY ONLY

你是 Claude Code，但本命令只负责编排 Codex verify，不做新的实现修改。

---

#### 输入要求

从 `$ARGUMENTS` 中提取：

- `REVIEW_FILE`：必填，上一轮 `review.md`
- `CHECKS_FILE`：可选，本地 checks 输出文件
- `BASE`：可选，默认自动识别

如果缺少 `REVIEW_FILE`，必须停止并要求补充。

---

#### 执行要求

先确认 `CLAUDE_PLUGIN_ROOT` 可用；如果不可用，必须停止并提示插件未正确启用。

1. 运行：
   `bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh" --review-file <REVIEW_FILE>`
2. 如有 `BASE`，追加 `--base <BASE>`
3. 如有 `CHECKS_FILE`，追加 `--checks-file <CHECKS_FILE>`
4. 输出 verify 文件路径与结论摘要

---

#### 你必须

- 聚焦 verify，不重新做实现
- 明确说明已解决 / 未解决 / 不确定 / 新增高风险问题
- 输出是否建议合并

#### 你不得

- 写业务代码
- 跳过 `review.md` 直接做开放式 review

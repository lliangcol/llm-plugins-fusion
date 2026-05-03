---
name: nova-codex-review-fix
description: "Run a semi-automated Codex review -> Claude Code fix -> local checks -> Codex verify closure loop for the current branch. Use when Claude Code should orchestrate review-driven fixes with external Bash scripts, structured review artifacts, validation reports, merge readiness, and residual-risk summaries."
license: MIT
allowed-tools: Bash Read Glob Grep LS Edit Write
argument-hint: "Example: codex-review-fix BASE=main GOAL='fix current branch until merge-ready'"
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: false
    destructiveActions: medium
---

## Inputs

| Parameter | Required | Default | Notes |
| --- | --- | --- | --- |
| `REVIEW_MODE` | No | branch | Review scope: branch, staged, or full. Maps to default, --only-staged, or --full. |
| `BASE` | No | Auto-detect | Baseline branch passed to review/verify scripts as --base. |
| `OUTPUT_DIR` | No | Script default | Review/verify artifact directory passed to Codex scripts as --output-dir. |
| `GOAL` | No | Fix high-confidence blockers | Natural-language goal for the closure loop. |
| `FIX_SCOPE` | No | high-confidence | Policy scope for selecting review findings to fix; does not widen script behavior. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to `GOAL`.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; probe Git status, base branches, and latest artifacts only for context parameters.
- Safety-boundary parameters for this skill: none for this skill.
- In non-interactive mode, fail before side effects when required or safety-boundary parameters are missing.
- Full policy: `nova-plugin/skills/_shared/parameter-resolution.md`.

## Safety Preflight

- This skill declares side-effect-capable tools: `Bash`, `Edit`, `Write`.
- Resolve parameters and present a preflight card before writing artifacts, editing project files, or running Bash.
- Show files or artifacts that may be written, scripts or commands that may run, disallowed operations, and the proceed condition.
- Do not infer missing safety-boundary values; ask once in interactive mode or fail in non-interactive mode.
- Preserve repository constraints: no destructive Git cleanup, no branch deletion, no push/merge/rebase, no editing archived agents as active agents.
- Full policy: `nova-plugin/skills/_shared/safety-preflight.md`.

## Codex Script Argument Mapping

- `REVIEW_MODE=branch` runs `codex-review.sh` without scope flags.
- `REVIEW_MODE=staged` adds `--only-staged`; `REVIEW_MODE=full` adds `--full`.
- `BASE` is passed as `--base <BASE>` to both review and verify scripts.
- `OUTPUT_DIR`, when provided, is passed as `--output-dir <OUTPUT_DIR>` to review and verify.
- If `OUTPUT_DIR` is provided, use `<OUTPUT_DIR>/review.md` for the fix step and write local checks to `<OUTPUT_DIR>/artifacts/checks.txt` so `codex-verify.sh` can auto-detect them when `--checks-file` is not passed.
- If `OUTPUT_DIR` is not provided, use the script's latest artifacts paths under `.codex/codex-review-fix/latest-artifacts/`.
- `GOAL` and `FIX_SCOPE` guide Claude Code's fix selection and summary; they are not script flags.

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

- Use `/codex-review-fix` as the full Codex review -> Claude Code fix -> checks -> verify loop.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### 目的

执行一个面向当前分支的半自动闭环：

1. 运行 Codex review 脚本产出结构化问题报告。
2. 阅读 `必须修`、`建议修` 中高置信问题。
3. 由 Claude Code 修改代码，必要时补测试。
4. 运行本地检查脚本。
5. 运行 Codex verify 脚本确认问题是否解决。
6. 输出闭环结论、剩余风险、下一步建议。

### 何时使用

- 当前分支已经有改动，需要先 review 再修复。
- 希望让 Claude Code 负责修复与编排，Codex 只做 reviewer / verifier。
- 需要一套可沉淀到仓库、可复制到其他项目的 review-fix workflow。

### 资源导航

- 主说明：`README.md`
- Prompt 模板：`prompts/*.prompt.md`
- 外部脚本：`scripts/*.sh`

只有在需要具体调用方式、参数细节或排障说明时再读取 `README.md`。

### 执行步骤

1. 先确认当前目录是 Git 仓库，并识别默认基线分支。
2. 运行 `scripts/codex-review.sh`。
3. 读取输出目录中的 `review.md`，只提取高置信、高优先级问题。
4. 参考 `prompts/claude-fix.prompt.md` 组织修复，不做与问题无关的大改。
5. 如问题涉及行为缺口，优先补单测或集成校验。
6. 运行 `scripts/run-project-checks.sh --all --report-file <checks-file>`。默认使用 `.codex/codex-review-fix/latest-artifacts/checks.txt`；显式 `OUTPUT_DIR` 时使用 `<OUTPUT_DIR>/artifacts/checks.txt`。
7. 运行 `scripts/codex-verify.sh --review-file <review.md> --checks-file <checks-file>`。
8. 读取 `verify.md`，按“已解决 / 未解决 / 不确定 / 新增高风险问题”总结。

### 优先级策略

- 先修 `必须修` 中会导致错误行为、数据风险、异常路径缺口、测试缺失的条目。
- 再处理 `建议修` 中高置信、低改动成本、能显著降低回归风险的条目。
- `可忽略` 不默认处理，除非顺手即可消除且不会扩大改动范围。

### 安全边界

- 不执行 `git reset --hard`、`git clean -fd`、批量删除等危险命令。
- 不把 Codex 产物当成绝对真理；对低置信问题保持克制。
- 不因为 review 报告而主动重构无关模块。
- 本技能默认只操作当前仓库工作区，不负责发布、部署或远程环境变更。

### 输出要求

- Review 阶段：保留 `review.md`。
- 修复阶段：总结已修改内容、未修改原因、补充测试情况。
- 校验阶段：保留 checks 输出摘要。
- Verify 阶段：保留 `verify.md`。
- 收尾：输出本轮是否建议合并、剩余阻塞项、后续建议。

### 变体

- `nova-codex-review-only`：只做 review，不进入修复闭环。
- `nova-codex-verify-only`：基于已有 `review.md` 做 verify。

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/codex-review-fix` (`nova-plugin/commands/codex-review-fix.md`).

### CODEX REVIEW -> FIX -> VERIFY LOOP

你是 Claude Code，扮演 **fixer / orchestrator**。

本命令用于当前分支的半自动闭环：

1. 运行 Codex review
2. 读取 review 结果
3. 只修复高置信、高优先级问题
4. 运行本地 checks
5. 运行 Codex verify
6. 输出本轮闭环结论

---

#### 输入参数

从 `$ARGUMENTS` 中提取以下信息：

- `BASE`：可选，review/verify 基线分支，默认自动识别
- `GOAL`：可选，本轮修复目标，例如“修到可合并”
- `REVIEW_MODE`：可选，`branch` / `staged` / `full`

如果未提供，按当前仓库状态做最保守且最合理的选择。

---

#### 强制执行流程

##### 第一步：运行 review 脚本

先确认 `CLAUDE_PLUGIN_ROOT` 可用；如果不可用，必须停止并提示插件未正确启用。

执行：

`bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-review.sh"`

根据参数决定是否追加：

- `--base <BASE>`
- `--only-staged`
- `--full`

##### 第二步：读取 review 结果

review 脚本会把结果写入 `.codex/codex-review-fix/latest-artifacts/review.md`（同时保留时间戳目录下的副本）。从该路径读取，只提取：

- `必须修`
- `建议修` 中高置信且高收益的问题

忽略低置信、纯风格、会扩大改动范围的问题。

##### 第三步：实施修复

- 只改与问题直接相关的代码
- 必要时补测试
- 不做无谓大改或额外重构

##### 第四步：运行本地验证

执行：

`bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/run-project-checks.sh" --all --report-file .codex/codex-review-fix/latest-artifacts/checks.txt`

##### 第五步：运行 verify 脚本

执行：

`bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh" --review-file .codex/codex-review-fix/latest-artifacts/review.md --checks-file .codex/codex-review-fix/latest-artifacts/checks.txt`

##### 第六步：输出总结

必须输出：

- 已修复问题
- 未修复问题及原因
- 本地验证结果
- Verify 结论
- 是否建议合并
- 剩余阻塞项
- 下一步建议

---

#### 严格限制

你必须：

- 优先修复高风险 / 高置信问题
- 保持改动最小闭环
- 如实报告验证结果

你不得：

- 把 Codex 的所有建议都强行落地
- 伪造检查通过
- 执行高风险 Git 清理操作
- 因 review 报告而主动重构无关模块

---

#### 结束条件

当以下条件满足时，本轮可视为闭环完成：

1. review 已生成
2. 代码修复已完成或明确受阻
3. 本地 checks 已执行
4. verify 已生成
5. 最终结论已输出

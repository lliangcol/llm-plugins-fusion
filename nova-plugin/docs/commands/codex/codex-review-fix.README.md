# /nova-plugin:codex-review-fix

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `codex-review-fix`; stage: `implement`; canonical skill: `nova-implement-plan`
- Purpose: Run an external Codex review, fix high-confidence findings, run project checks, and verify closure.
- Audience: `codex-users`; support risk: `medium`
- Inputs: `REVIEW_SCOPE` (required), `BASE`, `REVIEW_MODE`, `INCLUDE_UNTRACKED_CONTENT`
- Output contract: `codex-review-fix-v2`; authorization: `external-review-implementation`
- Effects: `credentials`, `network`, `shell`, `workspace-read`, `workspace-write`
- Related workflows: `codex-review-only`, `codex-verify-only`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/codex-review-fix.md`
- 资源目录：`nova-plugin/skills/nova-codex-review-fix/`

## 命令定位

- 用于当前分支的 Codex review/fix/verify 半自动闭环
- 适用：需要可重复执行、可沉淀产物、可做多轮复验的修复流程
- 不该用于：纯只读 review 或完全不需要 Codex 参与的本地小修

## 参数说明

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `REVIEW_SCOPE` | Yes | 要审查并修复的 Git diff 或仓库范围 | `当前分支相对 main 的 diff` |
| `BASE` | No | 基线分支 | `main` |
| `REVIEW_MODE` | No | `branch` / `staged` / `full` | `full` |
| `INCLUDE_UNTRACKED_CONTENT` | No | 仅与 `REVIEW_MODE=full` 搭配；显式允许未跟踪文件内容进入 review/verify patch，且必须通过大小、二进制、路径和 secret 检查 | `true` |

## 资源说明

- `scripts/codex-review.sh`：生成 review 报告
- `scripts/run-project-checks.sh`：统一项目校验入口
- `scripts/codex-verify.sh`：对上一轮问题做 verify
- `prompts/*.prompt.md`：Codex/Claude Code 的提示模板

## 典型示例

```text
/nova-plugin:codex-review-fix REVIEW_SCOPE="当前分支相对 main 的 diff；修复到可合并" BASE=main
```

```text
/nova-plugin:codex-review-fix REVIEW_SCOPE="已暂存改动中的高风险问题" REVIEW_MODE=staged
```

## 相关脚本直接调用

插件运行时建议使用 `${CLAUDE_PLUGIN_ROOT}`，避免依赖用户当前仓库里存在 `nova-plugin/` 目录。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-review.sh" --base main
bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/run-project-checks.sh" \
  --all \
  --report-file .codex/codex-review-fix/latest-artifacts/checks.txt
bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh" \
  --review-file .codex/codex-review-fix/latest-artifacts/review.md \
  --checks-file .codex/codex-review-fix/latest-artifacts/checks.txt \
  --base main
```

## 输出说明

- `review.md`：Codex 审查结论
- `verify.md`：Codex 复验结论
- `checks.txt`：本地 checks 完整输出
- `artifacts/*`：范围说明、patch、git 状态、最终 prompt 归档

## 与相近命令对比

- `/nova-plugin:codex-review-only`：只生成 review 报告，不修复
- `/nova-plugin:codex-verify-only`：只基于已有 review 做 verify
- `/nova-plugin:review-only`：纯 Claude Code 评审，不调用外部 Codex 脚本

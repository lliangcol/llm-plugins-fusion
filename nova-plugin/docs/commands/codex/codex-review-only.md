# Skill: /nova-plugin:codex-review-only

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `codex-review-only`; stage: `review`; canonical skill: `nova-review`
- Purpose: Produce an external Codex review artifact without modifying project code.
- Audience: `codex-users`; support risk: `low`
- Inputs: `REVIEW_SCOPE` (required), `BASE`, `REVIEW_MODE`
- Output contract: `codex-review-only-v2`; authorization: `external-review-read-only`
- Effects: `credentials`, `network`, `shell`, `workspace-read`
- Related workflows: `codex-review-fix`, `codex-verify-only`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/codex-review-only.md`

## 适用场景

- 只想先拿到 Codex 对当前分支的 review 报告
- 希望把 review 和 fix 分开执行
- 需要将 review 结果沉淀成 `review.md`

## 输入参数

### Required

- `REVIEW_SCOPE`: 要审查的 Git diff 或仓库范围

### Optional

- `BASE`: 基线分支
- `REVIEW_MODE`: `branch` / `staged` / `full`

## 详细执行步骤

1. 解析并确认 `REVIEW_SCOPE`
2. 调 `codex-review.sh`
3. 输出 `review.md` 路径
4. 简述 `必须修` / `建议修` 摘要

## 输出规范

- 不修改代码
- 提供 review 文件路径、`runtime-environment.txt` 路径与简要结论

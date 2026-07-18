# Skill: /nova-plugin:codex-verify-only

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `codex-verify-only`; stage: `review`; canonical skill: `nova-review`
- Purpose: Verify known findings from an existing Codex review without doing new implementation.
- Audience: `codex-users`; support risk: `low`
- Inputs: `REVIEW_FILE` (required), `CHECKS_FILE`, `BASE`
- Output contract: `codex-verify-only-v2`; authorization: `external-review-read-only`
- Effects: `credentials`, `network`, `shell`, `workspace-read`
- Related workflows: `codex-review-only`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/codex-verify-only.md`

## 适用场景

- 已有 `review.md`，只想判断问题是否已解决
- 修复完成后需要 Codex 给出 merge 建议
- 需要聚焦 verify 而非开放式 review

## 输入参数

### Required

- `REVIEW_FILE`: review 文件路径

### Optional

- `CHECKS_FILE`: checks 文件路径
- `BASE`: 基线分支

## 详细执行步骤

1. 读取 `REVIEW_FILE`
2. 如有本地 checks 输出，一并传入 `CHECKS_FILE`
3. 运行 `codex-verify.sh`
4. 输出 `verify.md` 路径与结论

## 输出规范

- 必须包含：已解决 / 未解决 / 不确定 / 新增高风险问题 / 是否建议合并
- 提供 verify 文件路径与 `verify.runtime-environment.txt` 路径

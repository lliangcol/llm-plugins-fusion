# Skill: /nova-plugin:finalize-work

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `finalize-work`; stage: `finalize`; canonical skill: `nova-finalize-work`
- Purpose: Package completed work into review-ready handoff text without changing the completed state.
- Audience: `all-users`; support risk: `none`
- Inputs: `WORK_SUMMARY` (required), `DEPTH`
- Output contract: `finalize-work-v2`; authorization: `read-only-shell-prompt`
- Effects: `shell`, `workspace-read`
- Related workflows: `finalize-lite`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/finalize-work.md`

## 适用场景

- 需要 commit message 与 PR 描述。
- 需要交接型变更总结。

## 输入参数

### Required

- `WORK_SUMMARY`: 已完成变更及验证上下文；当前任务上下文只有在显式确认后才可满足。别名：`WORK_SCOPE`。

### Optional

- `DEPTH`: 交接详细度，`lite` 或 `standard`，默认 `standard`。

## 行为准则（Do/Don't）

### Do

- 只基于已完成工作和实际验证结果生成交接内容。
- 按契约输出标题或 commit message、变更总结、验证、交接和范围外后续。

### Don't

- 新增改动或决策。
- 省略必填部分。

## 详细执行步骤

1. 解析并确认 `WORK_SUMMARY`，然后冻结工作范围。
2. 汇总实际完成的变更和验证状态。
3. 生成交接内容，并把剩余工作明确标为范围外。

## 输出规范

- 固定顺序输出 `title or commit message`、`change summary`、`validation`、`handoff`、`out-of-scope follow-up`。
- Git 可用时 `handoff` 可采用 PR 描述；无 Git 时采用手动交付步骤，但字段不变。

## 典型示例

```text
/nova-plugin:finalize-work
WORK_SUMMARY="已完成命令文档修复并通过 docs 校验"
```

```text
/nova-plugin:finalize-work
WORK_SUMMARY="无 Git 项目中的已完成改动与验证" DEPTH=lite
```

```text
/nova-plugin:finalize-work
请继续修改代码。
```

## 常见误用与纠正

- 误用：总结阶段修改代码。纠正：先冻结变更再总结。
- 误用：缺少契约字段。纠正：补全标题、变更总结、验证、交接和范围外后续。

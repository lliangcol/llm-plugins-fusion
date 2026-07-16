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

- 无

### Optional

- `WORK_SCOPE`: 当前已完成的改动范围（隐含）。示例: `当前工作区改动`

## 行为准则（Do/Don't）

### Do

- 根据 Git 有无选择输出模式。
- 包含变更/原因/限制/后续四个必填部分。

### Don't

- 新增改动或决策。
- 省略必填部分。

## 详细执行步骤

1. 确认工作冻结。
2. 判断是否存在 Git 仓库。
3. 生成对应输出并标注后续工作为范围外。

## 输出规范

- 有 Git：commit message + PR 描述；无 Git：本地总结 + 手动步骤。

## 典型示例

```text
/nova-plugin:finalize-work
请生成 commit message 和 PR 描述。
```

```text
/nova-plugin:finalize-work
无 Git 项目，请给出交接总结。
```

```text
/nova-plugin:finalize-work
请继续修改代码。
```

## 常见误用与纠正

- 误用：总结阶段修改代码。纠正：先冻结变更再总结。
- 误用：缺少必填四部分。纠正：补全变更/原因/限制/后续。

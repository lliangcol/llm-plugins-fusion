# Skill: /nova-plugin:finalize-lite

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `finalize-lite`; stage: `finalize`; canonical skill: `nova-finalize-work`
- Purpose: Provide a short factual closure summary without making new changes or decisions.
- Audience: `all-users`; support risk: `none`
- Inputs: `WORK_SUMMARY` (required)
- Output contract: `finalize-lite-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `finalize-work`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/finalize-lite.md`

## 适用场景

- 需要简短总结。
- 不需要完整交付材料。

## 输入参数

### Required

- `ARGUMENTS`: 总结范围说明。示例: `本次变更内容`

### Optional

- 无

## 行为准则（Do/Don't）

### Do

- 保持简短三点式输出。
- 不引入新决策。

### Don't

- 扩展范围或继续实施。
- 省略必填项。

## 详细执行步骤

1. 确认工作完成。
2. 输出 What/Why/Limitations 三要素。

## 输出规范

- 输出包含 What changed / Why / Limitations。

## 典型示例

```text
/nova-plugin:finalize-lite
总结这次修复。
```

```text
/nova-plugin:finalize-lite
用三行说明改动与限制。
```

```text
/nova-plugin:finalize-lite
请继续优化并改代码。
```

## 常见误用与纠正

- 误用：引入新决策或改动。纠正：仅总结已完成内容。
- 误用：缺少三要素之一。纠正：补全 What/Why/Limitations。

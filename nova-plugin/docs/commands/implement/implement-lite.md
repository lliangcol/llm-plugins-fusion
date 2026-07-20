# Skill: /nova-plugin:implement-lite

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `implement-lite`; stage: `implement`; canonical skill: `nova-implement-plan`
- Purpose: Deliver a small bounded implementation with focused validation and no unrelated refactoring.
- Audience: `all-users`; support risk: `medium`
- Inputs: `REQUEST` (required), `CONSTRAINTS`
- Output contract: `implementation-lite-v2`; authorization: `implementation`
- Effects: `shell`, `workspace-read`, `workspace-write`
- Related workflows: `implement-plan`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/implement-lite.md`

## 适用场景

- 小功能或快速修复。
- 明确指令的快速实现。

## 输入参数

### Required

- `REQUEST`: 实现目标与验收标准。示例: `修复手机号脱敏并补测试`

### Optional

- `CONSTRAINTS`: 范围与兼容性约束。示例: `不要修改公开 API`

## 行为准则（Do/Don't）

### Do

- 快速实现并保持务实。
- 仅做必要小幅调整。

### Don't

- 过度优化或扩展范围。
- 进行大重构。

## 详细执行步骤

1. 理解目标与约束。
2. 快速实现。
3. 避免范围漂移。

## 输出规范

- 固定顺序输出 `implemented changes`、`Changes Summary`、`Validation`、`Adjustments`。
- `Validation` 只能报告实际运行的检查；无调整时 `Adjustments` 明确写 `None`。

## 典型示例

```text
/nova-plugin:implement-lite
请快速实现手机号脱敏。
```

```text
/nova-plugin:implement-lite
优化枚举查找并补测试。
```

```text
/nova-plugin:implement-lite
请给出完整设计与架构方案。
```

## 常见误用与纠正

- 误用：过度工程或大范围重构。纠正：保持小范围变更。
- 误用：扩展超出需求。纠正：按给定范围实施。

# /nova-plugin:implement-lite

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

## 命令定位

- 快速、务实地完成实现，允许小幅调整与小范围重构。
- 适用：小功能或快速修复、明确指令的快速实现。
- 不该用于：严格按计划执行、深度设计或重大重构。

## 参数说明

| 参数          | 必填 | 说明                 | 示例               |
| ------------- | ---- | -------------------- | ------------------ |
| `REQUEST`     | Yes  | 实现目标与验收标准。 | `修复脱敏并补测试` |
| `CONSTRAINTS` | No   | 范围与兼容性约束。   | `不改公开 API`     |

## 输出说明

- 固定顺序为 `implemented changes`、`Changes Summary`、`Validation`、`Adjustments`。
- 示例输出结构：

```text
1. implemented changes
2. Changes Summary
3. Validation
4. Adjustments (or None)
```

## 完整示例

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

## 错误用法/反例

- 过度工程或大范围重构。
- 扩展超出需求。

## 与相近命令的对比

- `/nova-plugin:implement-standard` 更受控，需明确步骤。
- `/nova-plugin:implement-plan` 必须按批准计划执行。

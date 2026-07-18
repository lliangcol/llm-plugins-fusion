# /nova-plugin:implement-standard

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `implement-standard`; stage: `implement`; canonical skill: `nova-implement-plan`
- Purpose: Execute confirmed implementation steps reliably with controlled scope and validation.
- Audience: `all-users`; support risk: `medium`
- Inputs: `REQUEST` (required), `CONSTRAINTS`
- Output contract: `implementation-standard-v2`; authorization: `implementation`
- Effects: `shell`, `workspace-read`, `workspace-write`
- Related workflows: `implement-plan`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/implement-standard.md`

## 命令定位

- 基于确认的计划或清晰步骤执行实现，允许有限纠偏。
- 适用：有明确步骤、需要受控执行。
- 不该用于：严格按已批准计划执行、探索方案。

## 参数说明

| 参数          | 必填 | 说明                         | 示例                     |
| ------------- | ---- | ---------------------------- | ------------------------ |
| `REQUEST`     | Yes  | 已确认步骤及验收标准。       | `按步骤实现取消订单功能` |
| `CONSTRAINTS` | No   | 兼容性与范围限制。           | `保持现有接口兼容`       |

## 输出说明

- 固定顺序为 `code updates`、`Implementation Summary`、`Validation`、`Deviations`。
- 示例输出结构：

```text
1. code updates
2. Implementation Summary
3. Validation
4. Deviations (or None)
```

## 完整示例

```text
/nova-plugin:implement-standard
请按以下步骤实现取消订单功能：1) ... 2) ...
```

```text
/nova-plugin:implement-standard
根据确认步骤修复积分计算问题。
```

```text
/nova-plugin:implement-standard
请重新设计整体架构并实现。
```

## 错误用法/反例

- 在没有明确步骤时自行扩展范围。
- 发现阻塞问题仍继续实施。

## 与相近命令的对比

- `/nova-plugin:implement-plan` 需要 PLAN_APPROVED=true。
- `/nova-plugin:implement-lite` 更快速、约束更少。

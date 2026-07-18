# Skill: /nova-plugin:implement-standard

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

## 适用场景

- 有明确步骤但不一定是正式计划。
- 需要受控执行而非探索。

## 输入参数

### Required

- `REQUEST`: 已确认的步骤或执行依据及验收标准。示例: `按步骤实现取消订单功能`

### Optional

- `CONSTRAINTS`: 兼容性与范围限制。示例: `保持现有接口兼容`

## 行为准则（Do/Don't）

### Do

- 遵循提供的步骤作为主要指导。
- 遇到阻塞问题及时停止并说明。

### Don't

- 重新设计方案或扩展范围。
- 忽略阻塞问题继续推进。

## 详细执行步骤

1. 读取并确认提供的步骤或计划。
2. 按步骤实施，必要时做小幅纠偏。
3. 遇到阻塞问题停止并请求澄清。

## 输出规范

- 固定顺序输出 `code updates`、`Implementation Summary`、`Validation`、`Deviations`。
- `Validation` 只能报告实际运行的检查；无偏离时 `Deviations` 明确写 `None`。

## 典型示例

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

## 常见误用与纠正

- 误用：在没有明确步骤时自行扩展范围。纠正：请求明确步骤后再执行。
- 误用：发现阻塞问题仍继续实施。纠正：停止并请求澄清。

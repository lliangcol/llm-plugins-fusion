# Skill: /implement-standard

- 来源：`nova-plugin/commands/implement-standard.md`

## 适用场景

- 有明确步骤但不一定是正式计划。
- 需要受控执行而非探索。

## 输入参数

### Required

- 无

### Optional

- `ARGUMENTS`: 明确的计划或步骤说明。示例: `Step-by-step tasks list`

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

- 命令未规定固定输出结构；重点是按步骤完成实现。

## 典型示例

```text
/implement-standard
请按以下步骤实现取消订单功能：1) ... 2) ...
```

```text
/implement-standard
根据确认步骤修复积分计算问题。
```

```text
/implement-standard
请重新设计整体架构并实现。
```

## 常见误用与纠正

- 误用：在没有明确步骤时自行扩展范围。纠正：请求明确步骤后再执行。
- 误用：发现阻塞问题仍继续实施。纠正：停止并请求澄清。

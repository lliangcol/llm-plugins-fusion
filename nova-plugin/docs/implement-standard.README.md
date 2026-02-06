# /implement-standard

- 来源：`nova-plugin/commands/implement-standard.md`

## 命令定位

- 基于确认的计划或清晰步骤执行实现，允许有限纠偏。
- 适用：有明确步骤、需要受控执行。
- 不该用于：严格按已批准计划执行、探索方案。

## 参数说明

| 参数        | 必填 | 说明                   | 示例                      |
| ----------- | ---- | ---------------------- | ------------------------- |
| `ARGUMENTS` | No   | 明确的计划或步骤说明。 | `Step-by-step tasks list` |

## 输出说明

- 命令未规定固定输出结构；重点是按步骤完成实现。
- 示例输出结构：

```text
(命令未规定固定输出结构)
```

## 完整示例

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

## 错误用法/反例

- 在没有明确步骤时自行扩展范围。
- 发现阻塞问题仍继续实施。

## 与相近命令的对比

- `/implement-plan` 需要 PLAN_APPROVED=true。
- `/implement-lite` 更快速、约束更少。

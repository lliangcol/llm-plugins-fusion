# /implement-plan
- 来源：`nova-plugin/commands/implement-plan.md`

## 命令定位
- 严格按已批准计划执行实现，不允许随意偏离。
- 适用：已有正式计划并批准、需要可追溯执行。
- 不该用于：计划未批准、需要探索设计或扩展范围。

## 参数说明
| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `PLAN_INPUT_PATH` | Yes | 已批准计划的路径。 | `docs/plans/feature.md` |
| `PLAN_APPROVED` | Yes | 必须为 `true`（区分大小写）。 | `true` |

## 输出说明
- 聊天输出包含变更清单、简短实现总结与偏离说明（或明确无偏离）。
- 示例输出结构：
```text
1. Implemented code changes
2. Short implementation summary
3. Deviation notes (or "No deviations from the approved plan")
```

## 完整示例
```text
/implement-plan
PLAN_INPUT_PATH: docs/plans/feature.md
PLAN_APPROVED: true
```

```text
/implement-plan
PLAN_INPUT_PATH: docs/plans/bugfix.md
PLAN_APPROVED: true
```

```text
/implement-plan
PLAN_INPUT_PATH: docs/plans/feature.md
PLAN_APPROVED: false
```

## 错误用法/反例
- 缺少 PLAN_APPROVED=true 仍继续实施。
- 执行中擅自改设计或扩展范围。

## 与相近命令的对比
- `/implement-standard` 允许有限纠偏。
- `/implement-lite` 更快速且约束少。

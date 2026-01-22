# /produce-plan
- 来源：`nova-plugin/commands/produce-plan.md`

## 命令定位
- 输出正式可评审的规划与设计文档，并写入指定路径。
- 适用：设计评审前的正式计划、需要明确权衡与替代方案。
- 不该用于：轻量计划或直接实现代码。

## 参数说明
| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `PLAN_OUTPUT_PATH` | Yes | 计划文档输出路径。 | `docs/plans/feature.md` |
| `PLAN_INTENT` | Yes | 计划意图与目标描述。 | `Implement a specific feature` |
| `ANALYSIS_INPUTS` | No | 参考的分析产出（推荐）。 | `docs/analysis/feature.md` |
| `CONSTRAINTS` | No | 约束与边界条件。 | `Backward compatibility required` |

## 输出说明
- 写入完整计划到 PLAN_OUTPUT_PATH；聊天仅输出路径与三条执行摘要。
- 示例输出结构：
```text
计划文档结构:
1. Background & Problem Statement
2. Goals & Non-Goals
3. Constraints & Assumptions
4. Alternatives Considered
5. Final Approach & Rationale
6. Step-by-Step Implementation Plan
7. Risks & Mitigations
8. Test & Validation Strategy
9. Rollback Strategy

聊天输出:
<PLAN_OUTPUT_PATH>
- What is being done
- Why this approach was chosen
- Major risks or trade-offs
```

## 完整示例
```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/points-transfer.md
PLAN_INTENT: 实现积分转赠功能
```

```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/payment-retry.md
PLAN_INTENT: 修复支付回调重复问题
ANALYSIS_INPUTS:
- docs/analysis/payment-retry.md
```

```text
/produce-plan
PLAN_INTENT: 只有意图，没有提供输出路径
```

## 错误用法/反例
- 未提供 PLAN_OUTPUT_PATH 却继续生成计划。
- 在聊天中直接粘贴完整计划内容。

## 与相近命令的对比
- `/plan-lite` 输出轻量计划，不写入文件。
- `/backend-plan` 面向 Java/Spring 后端设计。

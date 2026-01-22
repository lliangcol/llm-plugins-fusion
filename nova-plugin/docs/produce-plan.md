# Skill: /produce-plan
- 来源：`nova-plugin/commands/produce-plan.md`

## 适用场景
- 需要设计评审前的正式计划产出。
- 需要明确权衡与替代方案的设计文档。

## 输入参数
### Required
- `PLAN_OUTPUT_PATH`: 计划文档输出路径。示例: `docs/plans/feature.md`
- `PLAN_INTENT`: 计划意图与目标描述。示例: `Implement a specific feature`

### Optional
- `ANALYSIS_INPUTS`: 参考的分析产出（推荐）。示例: `docs/analysis/feature.md`
- `CONSTRAINTS`: 约束与边界条件。示例: `Backward compatibility required`

## 行为准则（Do/Don't）
### Do
- 严格按照规定结构写入计划文档。
- 聊天输出仅包含路径与三条摘要。

### Don't
- 写或修改生产代码。
- 忽略替代方案或权衡讨论。

## 详细执行步骤
1. 抽取并校验 PLAN_OUTPUT_PATH 与 PLAN_INTENT。
2. 读取分析输入与约束，形成决策。
3. 按指定结构写入计划文档。
4. 在聊天中仅输出路径与三条摘要。

## 输出规范
- 写入完整计划到 PLAN_OUTPUT_PATH；聊天仅输出路径与三条执行摘要。

## 典型示例
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

## 常见误用与纠正
- 误用：未提供 PLAN_OUTPUT_PATH。纠正：补充输出路径后再执行。
- 误用：在聊天中粘贴完整计划。纠正：仅输出路径与摘要。

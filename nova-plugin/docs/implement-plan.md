# Skill: /implement-plan
- 来源：`nova-plugin/commands/implement-plan.md`

## 适用场景
- 已有正式计划并已批准。
- 需要严格执行与可追溯实现。

## 输入参数
### Required
- `PLAN_INPUT_PATH`: 已批准计划的路径。示例: `docs/plans/feature.md`
- `PLAN_APPROVED`: 必须为 `true`（区分大小写）。示例: `true`

### Optional
- 无

## 行为准则（Do/Don't）
### Do
- 先读取计划文件再开始实现。
- 严格遵守计划目标、非目标与约束。
- 出现偏离时明确说明并评估是否需要更新计划。

### Don't
- 重新设计或添加新功能。
- 进行计划外优化或重构。

## 详细执行步骤
1. 校验 PLAN_INPUT_PATH 与 PLAN_APPROVED=true。
2. 读取计划并按步骤实施。
3. 记录并说明偏离或确认无偏离。

## 输出规范
- 聊天输出包含变更清单、简短实现总结与偏离说明（或明确无偏离）。

## 典型示例
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

## 常见误用与纠正
- 误用：缺少 PLAN_APPROVED=true 仍继续实施。纠正：补充批准标记后再执行。
- 误用：执行中擅自改设计或扩展范围。纠正：停止并请求计划更新。

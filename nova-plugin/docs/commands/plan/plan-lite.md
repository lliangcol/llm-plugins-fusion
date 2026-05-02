# Skill: /plan-lite

- 来源：`nova-plugin/commands/plan-lite.md`

## 适用场景

- 需要快速形成执行路径但不要求正式设计文档。
- 已有基础理解，希望确认范围与关键决策。

## 输入参数

### Required

- 无

### Optional

- `ARGUMENTS`: 需求或上下文描述。示例: `目标与约束说明`

## 行为准则（Do/Don't）

### Do

- 明确目标、非目标与关键取舍。
- 保持高层步骤，避免实现细节。

### Don't

- 写代码或给出详细实现。
- 扩展超出输入的范围。

## 详细执行步骤

1. 读取输入并澄清目标与边界。
2. 写出高层方法与关键取舍。
3. 列出执行大纲与关键风险。

## 输出规范

- 固定输出 Goal / Non-Goals / Chosen Approach / Key Trade-offs / Execution Outline / Key Risks。

## 典型示例

```text
/plan-lite
目标：新增用户积分转赠
边界：不改动支付模块
```

```text
/plan-lite
基于已完成分析产出轻量计划，关注风险与取舍。
```

```text
/plan-lite
请给出详细架构设计和实现细节。
```

## 常见误用与纠正

- 误用：写入生产代码或实现细节。纠正：保持高层计划而非实现。
- 误用：过度扩展范围。纠正：只覆盖输入边界。

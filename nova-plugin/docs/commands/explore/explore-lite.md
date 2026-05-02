# Skill: /explore-lite

- 来源：`nova-plugin/commands/explore-lite.md`

## 适用场景

- 快速梳理输入信息的清晰度与缺口。
- 会议前的简短认知对齐。

## 输入参数

### Required

- 无

### Optional

- `ARGUMENTS`: 任意输入上下文或问题描述。示例: `需求描述或日志片段`

## 行为准则（Do/Don't）

### Do

- 聚焦已知事实、未知点与潜在风险。
- 保持输出简洁实用。

### Don't

- 提出设计方案或重构建议。
- 输出实现细节或代码。

## 详细执行步骤

1. 读取输入内容并提取清晰事实。
2. 标注信息缺口与不确定项。
3. 列出由未知引发的潜在风险。

## 输出规范

- 输出固定为 Observations / Uncertainties / Potential risks。

## 典型示例

```text
/explore-lite
我们要新增订单退款接口，已有订单模块与支付模块。请快速梳理不清楚的点。
```

```text
/explore-lite
线上告警：Connection pool exhausted。请列出不确定点和可能风险。
```

```text
/explore-lite
请直接给我完整解决方案和实施步骤。
```

## 常见误用与纠正

- 误用：提出设计方案或重构建议。纠正：仅输出认知对齐与风险信号。
- 误用：输出实现细节或代码。纠正：保持“理解与风险”而非方案。

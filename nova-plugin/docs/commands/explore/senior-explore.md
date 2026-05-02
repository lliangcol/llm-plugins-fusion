# Skill: /senior-explore

- 来源：`nova-plugin/commands/senior-explore.md`

## 适用场景

- 需要在不设计方案的前提下做深入分析与认知对齐。
- 需要输出可留存的分析快照（可选导出）。

## 输入参数

### Required

- `INTENT`: 分析意图。示例: `Analyze a new feature requirement`

### Optional

- `CONTEXT`: 上下文材料。示例: `Logs, code paths`
- `CONSTRAINTS`: 分析边界与约束。示例: `Only analyze current implementation`
- `DEPTH`: 分析深度。示例: `deep`
- `EXPORT_PATH`: 导出路径。示例: `docs/analysis/issue.md`

## 行为准则（Do/Don't）

### Do

- 显式抽取并确认 INTENT。
- 区分事实、推断与假设。
- 如提供 EXPORT_PATH，导出与聊天完全一致的内容。

### Don't

- 提出方案、修复建议或实现步骤。
- 写或修改代码。

## 详细执行步骤

1. 从参数中提取 INTENT、CONTEXT、CONSTRAINTS、DEPTH、EXPORT_PATH。
2. 按约束进行分析，明确事实、推断与假设。
3. 输出固定结构的三段内容。
4. 若指定导出路径，写入相同内容并不扩展。

## 输出规范

- 聊天输出固定结构：Key findings / Open questions / Potential risks；若指定 EXPORT_PATH，需将相同内容写入文件。

## 典型示例

```text
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT: 需求文档与现有模块概述
```

```text
/senior-explore
INTENT: Investigate a production issue or bug
CONTEXT: 日志与相关模块
DEPTH: deep
EXPORT_PATH: docs/analysis/payment-issue.md
```

```text
/senior-explore
CONTEXT: 只有上下文，没有提供 INTENT
```

## 常见误用与纠正

- 误用：要求给出解决方案或实施步骤。纠正：仅输出分析结果，避免方案与实现。
- 误用：输出中使用 should/solution/implement。纠正：改用 observed/appears/may indicate 等措辞。

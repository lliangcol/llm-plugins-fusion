# Skill: /review-lite
- 来源：`nova-plugin/commands/review-lite.md`

## 适用场景
- 日常 PR 或小改动的快速审查。
- 需要高信号、低成本的反馈。

## 输入参数
### Required
- 无

### Optional
- `ARGUMENTS`: 待审查的变更或描述。示例: `PR diff`

## 行为准则（Do/Don't）
### Do
- 保持简洁，聚焦明显问题。
- 使用标签标注类型。

### Don't
- 提出大规模重构建议。
- 写或修改代码。

## 详细执行步骤
1. 阅读输入内容，识别明显问题。
2. 按 Findings 列表输出短结论。
3. 若无问题明确说明。

## 输出规范
- 输出为 Findings 列表；无问题时明确说明无明显问题。

## 典型示例
```text
/review-lite
请快速审查这段 PR diff：...
```

```text
/review-lite
这段逻辑描述是否有明显风险？
```

```text
/review-lite
请做完整架构审计并给出重构方案。
```

## 常见误用与纠正
- 误用：提出大规模重构建议。纠正：仅输出明显问题。
- 误用：写或修改代码。纠正：保持评审输出。

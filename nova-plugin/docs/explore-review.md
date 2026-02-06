# Skill: /explore-review

- 来源：`nova-plugin/commands/explore-review.md`

## 适用场景

- 审阅需求或方案描述。
- 识别含糊点与风险信号。

## 输入参数

### Required

- 无

### Optional

- `ARGUMENTS`: 待审阅内容。示例: `需求文档或方案描述`

## 行为准则（Do/Don't）

### Do

- 区分事实与解读。
- 集中提出审阅问题与风险信号。

### Don't

- 提出具体方案或实现建议。
- 使用 should/recommend/solution/implement 等措辞。

## 详细执行步骤

1. 读取输入并确认清晰点。
2. 输出审阅问题，聚焦正确性与假设。
3. 列出风险信号，不给出解决路径。

## 输出规范

- 固定输出 What is clear / Review questions / Risk signals。

## 典型示例

```text
/explore-review
这是需求描述，请输出审阅问题。
```

```text
/explore-review
这是方案描述，请给出风险信号。
```

```text
/explore-review
请直接给出解决方案。
```

## 常见误用与纠正

- 误用：提出方案或实现建议。纠正：只输出问题与风险信号。
- 误用：使用 should/solution 等措辞。纠正：改用 appears/may indicate。

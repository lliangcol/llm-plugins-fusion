# Skill: /plan-review
- 来源：`nova-plugin/commands/plan-review.md`

## 适用场景
- 评审计划清晰度与风险。
- 执行前发现隐含问题。

## 输入参数
### Required
- 无

### Optional
- `ARGUMENTS`: 待审阅的计划内容或摘要。示例: `计划文档内容`

## 行为准则（Do/Don't）
### Do
- 聚焦决策清晰度、假设与风险。
- 提出必须回答的问题。

### Don't
- 重写计划或提出替代方案。
- 写代码或实现建议。

## 详细执行步骤
1. 阅读计划内容并识别核心决策。
2. 列出隐含假设与缺口。
3. 输出风险信号与审阅问题。

## 输出规范
- 固定输出 Decision clarity check / Assumptions & gaps / Risk signals / Review questions。

## 典型示例
```text
/plan-review
请审阅以下计划摘要：...
```

```text
/plan-review
计划文档链接或内容粘贴在这里。
```

```text
/plan-review
请给出替代方案并重新写计划。
```

## 常见误用与纠正
- 误用：提出替代方案或新增需求。纠正：只输出问题与风险信号。
- 误用：使用 should/recommend/solution。纠正：改用 appears/may lead to。

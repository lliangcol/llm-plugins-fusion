# /plan-review
- 来源：`nova-plugin/commands/plan-review.md`

## 命令定位
- 从决策质量与执行风险视角审阅计划文档，不提供方案。
- 适用：评审计划清晰度、假设与风险。
- 不该用于：改写计划或提出替代方案、代码评审。

## 参数说明
| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `ARGUMENTS` | No | 待审阅的计划内容或摘要。 | `计划文档内容` |

## 输出说明
- 固定输出 Decision clarity check / Assumptions & gaps / Risk signals / Review questions。
- 示例输出结构：
```text
### Decision clarity check
- ...

### Assumptions & gaps
- ...

### Risk signals
- ...

### Review questions
- ...
```

## 完整示例
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

## 错误用法/反例
- 提出替代方案或新增需求。
- 使用 should/recommend/solution 等措辞。

## 与相近命令的对比
- `/explore-review` 适用于通用输入审阅。
- `/review-only` 面向代码评审，不是计划文档。

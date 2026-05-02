# /explore-review

- 来源：`nova-plugin/commands/explore-review.md`

## 命令定位

- 以审阅视角提出问题与风险信号，不给方案。
- 适用：审阅需求/方案描述、识别含糊点与风险信号。
- 不该用于：设计/实现方案、代码修改。

## 参数说明

| 参数        | 必填 | 说明         | 示例                 |
| ----------- | ---- | ------------ | -------------------- |
| `ARGUMENTS` | No   | 待审阅内容。 | `需求文档或方案描述` |

## 输出说明

- 固定输出 What is clear / Review questions / Risk signals。
- 示例输出结构：

```text
### What is clear
- ...

### Review questions
- ...

### Risk signals
- ...
```

## 完整示例

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

## 错误用法/反例

- 提出具体方案或实现建议。
- 使用 should/recommend/solution/implement 等措辞。

## 与相近命令的对比

- `/explore-lite` 更偏快速对齐。
- `/plan-review` 专注计划文档审阅。

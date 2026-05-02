# /review-lite

- 来源：`nova-plugin/commands/review-lite.md`

## 命令定位

- 进行快速轻量审查，聚焦明显问题。
- 适用：日常 PR 快速审查、高信号反馈。
- 不该用于：高风险全面审计或实现方案输出。

## 参数说明

| 参数        | 必填 | 说明         | 示例      |
| ----------- | ---- | ------------ | --------- |
| `ARGUMENTS` | No   | 待审查内容。 | `PR diff` |

## 输出说明

- 输出 Findings 列表，可带标签；无问题时明确说明。
- 示例输出结构：

```text
### Findings
- [Bug] ...

No obvious issues found in this review scope.
```

## 完整示例

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
请给出完整重构方案。
```

## 错误用法/反例

- 提出大规模重构建议。
- 写或修改代码。

## 与相近命令的对比

- `/review-only` 更系统分级审查。
- `/review-strict` 高风险全面审查。

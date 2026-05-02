# /senior-explore

- 来源：`nova-plugin/commands/senior-explore.md`

## 命令定位

- 深度分析与理解，澄清事实、假设与风险，不输出方案。
- 适用：系统性分析或风险识别、需要分析快照导出。
- 不该用于：需要设计/实现方案、需要输出代码。

## 参数说明

| 参数          | 必填 | 说明                     | 示例                                  |
| ------------- | ---- | ------------------------ | ------------------------------------- |
| `INTENT`      | Yes  | 分析意图。               | `Analyze a new feature requirement`   |
| `CONTEXT`     | No   | 上下文材料。             | `Logs and modules`                    |
| `CONSTRAINTS` | No   | 分析边界与约束。         | `Only analyze current implementation` |
| `DEPTH`       | No   | 分析深度。               | `deep`                                |
| `EXPORT_PATH` | No   | 导出路径（与聊天一致）。 | `docs/analysis/issue.md`              |

## 输出说明

- 输出固定结构：Key findings / Open questions / Potential risks；可选导出相同内容。
- 示例输出结构：

```text
### Key findings
- ...

### Open questions
- ...

### Potential risks
- ...
```

## 完整示例

```text
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT: 需求文档与现有模块概述
```

```text
/senior-explore
INTENT: Investigate a production issue or bug
DEPTH: deep
EXPORT_PATH: docs/analysis/payment-issue.md
```

```text
/senior-explore
CONTEXT: 只有上下文，没有提供 INTENT
```

## 错误用法/反例

- 要求输出解决方案或实施步骤。
- 输出中使用 should/solution/implement 等措辞。

## 与相近命令的对比

- `/explore-lite` 更快、更浅，侧重快速认知对齐。
- `/explore-review` 侧重审阅问题与风险信号，不做系统性分析。

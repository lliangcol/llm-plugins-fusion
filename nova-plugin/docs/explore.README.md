# /explore

- 来源：`nova-plugin/commands/explore.md`

## 命令定位

- 统一探索入口，按视角输出事实、未知点和风险信号。
- 适用：快速理解需求、问题、日志或代码上下文。
- 不该用于：方案设计、实现或重构建议。

## 参数说明

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `PERSPECTIVE` | No | `observer` / `reviewer`，默认 `observer` | `reviewer` |
| `ARGUMENTS` | No | 任意输入上下文或问题描述 | `需求说明或日志片段` |

## 完整示例

```text
/explore
我们要新增订单退款接口，请先快速梳理已知事实、不确定点和潜在风险。
```

```text
/explore PERSPECTIVE=reviewer
请以评审者视角阅读这份需求，只输出清楚的内容、评审问题和风险信号。
```

## 与相近命令的对比

- `/explore-lite` 是轻量观察者视角。
- `/explore-review` 是评审者视角。
- `/senior-explore` 更深、更系统，并支持导出分析产物。


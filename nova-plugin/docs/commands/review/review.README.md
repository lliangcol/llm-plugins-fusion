# /review

- 来源：`nova-plugin/commands/review.md`

## 命令定位

- 统一代码/内容评审入口，支持轻量、标准和严格三种深度。
- 适用：审查代码片段、实现说明、设计片段或变更描述。
- 不该用于：直接修复、生成完整实现或替代人工审批。

## 参数说明

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `LEVEL` | No | `lite` / `standard` / `strict`，默认 `standard` | `lite` |
| `ARGUMENTS` | Yes | 待评审内容 | `代码片段或实现描述` |

## 完整示例

```text
/review
请审查以下订单状态流转实现说明：...
```

```text
/review LEVEL=strict
请严格审查这段支付回调代码，重点看并发、幂等和数据一致性。
```

```text
/review LEVEL=lite
请快速审查这个小型 PR diff，只输出高信号问题。
```

## 与相近命令的对比

- `/review LEVEL=lite` 等价于 `/review-lite` 轻量快速评审入口。
- `/review LEVEL=standard` 等价于 `/review-only` 标准深度传统入口。
- `/review LEVEL=strict` 等价于 `/review-strict` 严格审计入口。

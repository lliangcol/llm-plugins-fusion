# Skill: /review

- 来源：`nova-plugin/commands/review.md`

## 用途

`/review` 是统一评审入口，用于对提供的代码、设计或内容做只读评审。

## 参数

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `LEVEL` | No | `standard` 或 `strict`，默认 `standard` | `strict` |
| `ARGUMENTS` | Yes | 待评审内容 | `代码片段或实现说明` |

## 输出

按严重性分组：

- Critical
- Major
- Minor

每条发现应说明问题、影响和方向性改进建议。

## 示例

```text
/review
请评审以下实现说明：...
```

```text
/review LEVEL=strict
请严格评审这段支付回调代码，关注并发、数据一致性和安全风险。
```

## 注意事项

- 不写或修改代码。
- 不提供完整实现。
- 不扩展到未提供的范围。


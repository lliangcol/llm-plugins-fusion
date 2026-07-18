# Skill: /nova-plugin:review

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `review`; stage: `review`; canonical skill: `nova-review`
- Purpose: Perform evidence-grounded code or design review at the requested depth and output mode without implementation.
- Audience: `all-users`; support risk: `none`
- Inputs: `REVIEW_SCOPE` (required), `LEVEL`, `MODE`, `REVIEW_PROFILE`
- Output contract: `review-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `review-lite`, `review-strict`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/review.md`

## 用途

`/nova-plugin:review` 是统一评审入口，用于对已提供的代码、设计、patch，或明确可读的文件/路径集合做只读评审。仅写“当前分支”“这个 PR”或“相对 main 的 diff”不会自动解析 Git 状态；此时应先提供 patch 或明确路径。

## 参数

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `LEVEL` | No | `lite`、`standard` 或 `strict`，默认 `standard` | `lite` |
| `ARGUMENTS` | Yes | 待评审内容 | `代码片段或实现说明` |

## 输出

按严重性分组：

- Critical
- Major
- Minor

每条发现应说明问题、影响和方向性改进建议。

`LEVEL=lite` 路由到轻量快速评审，输出更短的 bullet findings。

## 示例

```text
/nova-plugin:review
请评审以下实现说明：...
```

```text
/nova-plugin:review LEVEL=strict
请严格评审这段支付回调代码，关注并发、数据一致性和安全风险。
```

```text
/nova-plugin:review LEVEL=lite
请快速评审这个小型 PR diff，优先指出明显风险。
```

## 注意事项

- 不写或修改代码。
- 不提供完整实现。
- 不扩展到未提供的范围。
- 不会自动切换到 Codex 评审；只有用户明确选择对应 profile 且满足运行时批准时才使用。

# Skill: /nova-plugin:explore

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `explore`; stage: `explore`; canonical skill: `nova-explore`
- Purpose: Align understanding and identify unknowns or risks without proposing solutions.
- Audience: `all-users`; support risk: `none`
- Inputs: `INPUT` (required), `PERSPECTIVE`, `DEPTH`
- Output contract: `exploration-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `route`, `produce-plan`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/explore.md`

## 用途

`/nova-plugin:explore` 是统一探索入口，用于快速理解输入、对齐事实、暴露不确定点和风险信号。

## 参数

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `PERSPECTIVE` | No | `observer` 或 `reviewer`，默认 `observer` | `reviewer` |
| `ARGUMENTS` | No | 待理解的需求、代码路径、日志或问题描述 | `订单退款需求说明` |

## 输出

当 `PERSPECTIVE=observer`：

- Observations
- Uncertainties
- Potential risks

当 `PERSPECTIVE=reviewer`：

- What is clear
- Review questions
- Risk signals

## 示例

```text
/nova-plugin:explore PERSPECTIVE=observer
我们要新增订单退款接口，请先梳理当前信息和不确定点。
```

```text
/nova-plugin:explore PERSPECTIVE=reviewer
请从评审者视角审视这份需求说明，只提出问题和风险信号。
```

## 注意事项

- 不写代码。
- 不提出解决方案、设计方案或重构建议。
- 如需更深度探索，使用 `/nova-plugin:senior-explore`。


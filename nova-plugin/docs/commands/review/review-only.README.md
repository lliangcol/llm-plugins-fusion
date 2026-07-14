# /nova-plugin:review-only

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `review-only`; stage: `review`; canonical skill: `nova-review`
- Purpose: Perform standard evidence-grounded review and group findings by severity without implementation.
- Audience: `reviewers`; support risk: `none`
- Inputs: `REVIEW_SCOPE` (required)
- Output contract: `review-only-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `review`, `codex-review-only`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/review-only.md`

## 命令定位

- 严格评审，按严重性分组并给出方向性建议。
- 适用：系统性评审代码或实现描述。
- 不该用于：实现代码输出或快速轻量审查。

## 参数说明

| 参数        | 必填 | 说明         | 示例                 |
| ----------- | ---- | ------------ | -------------------- |
| `ARGUMENTS` | No   | 待评审内容。 | `代码片段或实现描述` |

## 输出说明

- 输出按 Critical / Major / Minor 分组，并给出方向性建议。
- 示例输出结构：

```text
### Critical
- Issue / Why / Directional suggestion

### Major
- ...

### Minor
- ...
```

## 完整示例

```text
/nova-plugin:review-only
请审查以下代码片段：...
```

```text
/nova-plugin:review-only
以下是实现描述，请分级输出问题。
```

```text
/nova-plugin:review-only
请给出完整修复代码。
```

## 错误用法/反例

- 提供实现级修复。
- 扩展到未提供范围。

## 与相近命令的对比

- `/nova-plugin:review-lite` 轻量快速审查。
- `/nova-plugin:review-strict` 高风险全面审计。

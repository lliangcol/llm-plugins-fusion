# /nova-plugin:codex-review-only

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `codex-review-only`; stage: `review`; canonical skill: `nova-review`
- Purpose: Produce an external Codex review artifact without modifying project code.
- Audience: `codex-users`; support risk: `low`
- Inputs: `REVIEW_SCOPE` (required), `BASE`, `REVIEW_MODE`
- Output contract: `codex-review-only-v2`; authorization: `external-review-read-only`
- Effects: `credentials`, `network`, `shell`, `workspace-read`
- Related workflows: `codex-review-fix`, `codex-verify-only`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/codex-review-only.md`

## 命令定位

- 使用外部脚本调起 Codex，对当前分支输出结构化 review 报告
- 输出 `review.md` 与 `runtime-environment.txt`
- 适用：想先 review，暂时不进入修复

## 参数说明

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `REVIEW_SCOPE` | Yes | 要审查的 Git diff 或仓库范围 | `当前分支相对 main 的 diff` |
| `BASE` | No | 基线分支 | `main` |
| `REVIEW_MODE` | No | `branch` / `staged` / `full` | `staged` |

## 示例

```text
/nova-plugin:codex-review-only REVIEW_SCOPE="当前分支相对 main 的 diff" BASE=main
```

```text
/nova-plugin:codex-review-only REVIEW_SCOPE="整个当前工作区" REVIEW_MODE=full
```

通过插件运行时，内部脚本应优先经 `${CLAUDE_PLUGIN_ROOT}` 调用，而不是假设当前仓库存在 `nova-plugin/` 目录。

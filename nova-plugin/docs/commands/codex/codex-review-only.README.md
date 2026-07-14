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
| `BASE` | No | 基线分支 | `main` |
| `REVIEW_MODE` | No | `branch` / `staged` / `full` | `staged` |
| `OUTPUT_DIR` | No | review artifact 输出目录 | `.codex/codex-review-fix/custom` |

## 示例

```text
/nova-plugin:codex-review-only BASE=main
```

```text
/nova-plugin:codex-review-only REVIEW_MODE=full
```

通过插件运行时，内部脚本应优先经 `${CLAUDE_PLUGIN_ROOT}` 调用，而不是假设当前仓库存在 `nova-plugin/` 目录。

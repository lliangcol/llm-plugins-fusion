# /nova-plugin:codex-verify-only

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `codex-verify-only`; stage: `review`; canonical skill: `nova-review`
- Purpose: Verify known findings from an existing Codex review without doing new implementation.
- Audience: `codex-users`; support risk: `low`
- Inputs: `REVIEW_FILE` (required), `CHECKS_FILE`, `BASE`
- Output contract: `codex-verify-only-v2`; authorization: `external-review-read-only`
- Effects: `credentials`, `network`, `shell`, `workspace-read`
- Related workflows: `codex-review-only`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/codex-verify-only.md`

## 命令定位

- 基于已有 `review.md` 做 Codex verify
- 输出 `verify.md` 与 `verify.runtime-environment.txt`
- 适用：修复后复验、多人协作二次确认

## 参数说明

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `REVIEW_FILE` | Yes | 上一轮 `review.md` 路径 | `.codex/codex-review-fix/latest-artifacts/review.md` |
| `CHECKS_FILE` | No | 本地 checks 输出文件 | `.codex/codex-review-fix/latest-artifacts/checks.txt` |
| `BASE` | No | 基线分支 | `main` |
| `OUTPUT_DIR` | No | verify artifact 输出目录 | `.codex/codex-review-fix/custom` |
| `INCLUDE_UNTRACKED_CONTENT` | No | 显式允许未跟踪文件内容进入 verify patch，且需通过安全检查 | `true` |

## 示例

```text
/nova-plugin:codex-verify-only REVIEW_FILE=.codex/codex-review-fix/latest-artifacts/review.md CHECKS_FILE=.codex/codex-review-fix/latest-artifacts/checks.txt BASE=main
```

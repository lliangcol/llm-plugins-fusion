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

- Source: `nova-plugin/commands/codex-verify-only.md`

## Command Positioning

- Runs Codex verification against an existing `review.md`.
- Outputs `verify.md` and `verify.runtime-environment.txt`.
- Use when: fixes have been applied and you need a second-pass verification artifact.

## Parameters

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `REVIEW_FILE` | Yes | Previous `review.md` path | `.codex/codex-review-fix/latest-artifacts/review.md` |
| `CHECKS_FILE` | No | Local checks output file | `.codex/codex-review-fix/latest-artifacts/checks.txt` |
| `BASE` | No | Base branch | `main` |
| `OUTPUT_DIR` | No | Verify artifact directory | `.codex/codex-review-fix/custom` |
| `INCLUDE_UNTRACKED_CONTENT` | No | Explicitly allows guarded untracked file content into the verify patch | `true` |

## Example

```text
/nova-plugin:codex-verify-only REVIEW_FILE=.codex/codex-review-fix/latest-artifacts/review.md CHECKS_FILE=.codex/codex-review-fix/latest-artifacts/checks.txt BASE=main
```

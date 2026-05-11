# /codex-verify-only

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

## Example

```text
/codex-verify-only REVIEW_FILE=.codex/codex-review-fix/latest-artifacts/review.md CHECKS_FILE=.codex/codex-review-fix/latest-artifacts/checks.txt BASE=main
```

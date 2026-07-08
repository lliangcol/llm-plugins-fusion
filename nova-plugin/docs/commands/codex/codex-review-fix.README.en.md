# /codex-review-fix

- Source: `nova-plugin/commands/codex-review-fix.md`
- Resource directory: `nova-plugin/skills/nova-codex-review-fix/`

## Command Positioning

- Runs a semi-automated Codex review -> Claude Code fix -> local checks -> Codex verify loop for the current branch.
- Use when: you need review artifacts, bounded fixes, local checks, and verification in one repeatable workflow.
- Not for: read-only review or small local edits that do not need Codex involvement.

## Parameters

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `BASE` | No | Base branch for review / verify | `main` |
| `GOAL` | No | Goal for this fix loop | `make branch mergeable` |
| `REVIEW_MODE` | No | `branch` / `staged` / `full` | `staged` |
| `OUTPUT_DIR` | No | Review / verify artifact directory | `.codex/codex-review-fix/custom` |
| `FIX_SCOPE` | No | Fix-selection policy; does not change script behavior | `high-confidence` |
| `INCLUDE_UNTRACKED_CONTENT` | No | Only with `REVIEW_MODE=full`; explicitly allows guarded untracked file content into review / verify patches | `true` |

## Examples

```text
/codex-review-fix BASE=main GOAL="fix current branch until mergeable"
```

```text
/codex-review-fix REVIEW_MODE=staged GOAL="handle only high-risk staged findings"
```

## Outputs

- `review.md`: Codex review findings.
- `verify.md`: Codex verification result.
- `checks.txt`: local checks output.
- `artifacts/*`: scope, patch, git status, and prompt archives.

## Related Commands

- `/codex-review-only`: generate a review report only.
- `/codex-verify-only`: verify against an existing review.
- `/review-only`: Claude Code review only, without external Codex scripts.

# /nova-plugin:codex-review-fix

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `codex-review-fix`; stage: `implement`; canonical skill: `nova-implement-plan`
- Purpose: Run an external Codex review, fix high-confidence findings, run project checks, and verify closure.
- Audience: `codex-users`; support risk: `medium`
- Inputs: `REVIEW_SCOPE` (required), `BASE`, `REVIEW_MODE`, `INCLUDE_UNTRACKED_CONTENT`
- Output contract: `codex-review-fix-v2`; authorization: `external-review-implementation`
- Effects: `credentials`, `network`, `shell`, `workspace-read`, `workspace-write`
- Related workflows: `codex-review-only`, `codex-verify-only`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/codex-review-fix.md`
- Resource directory: `nova-plugin/skills/nova-codex-review-fix/`

## Command Positioning

- Runs a semi-automated Codex review -> Claude Code fix -> local checks -> Codex verify loop for the current branch.
- Use when: you need review artifacts, bounded fixes, local checks, and verification in one repeatable workflow.
- Not for: read-only review or small local edits that do not need Codex involvement.

## Parameters

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `REVIEW_SCOPE` | Yes | Git diff or repository scope to review and repair | `Current branch diff against main` |
| `BASE` | No | Base branch for review / verify | `main` |
| `REVIEW_MODE` | No | `branch` / `staged` / `full` | `staged` |
| `INCLUDE_UNTRACKED_CONTENT` | No | Only with `REVIEW_MODE=full`; explicitly allows guarded untracked file content into review / verify patches | `true` |

## Examples

```text
/nova-plugin:codex-review-fix REVIEW_SCOPE="current branch diff against main; repair until mergeable" BASE=main
```

```text
/nova-plugin:codex-review-fix REVIEW_SCOPE="high-risk findings in staged changes" REVIEW_MODE=staged
```

## Outputs

- `review.md`: Codex review findings.
- `verify.md`: Codex verification result.
- `checks.txt`: local checks output.
- `artifacts/*`: scope, patch, git status, and prompt archives.

## Related Commands

- `/nova-plugin:codex-review-only`: generate a review report only.
- `/nova-plugin:codex-verify-only`: verify against an existing review.
- `/nova-plugin:review-only`: Claude Code review only, without external Codex scripts.

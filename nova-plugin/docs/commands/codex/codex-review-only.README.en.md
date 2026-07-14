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

- Source: `nova-plugin/commands/codex-review-only.md`

## Command Positioning

- Runs the Codex review script and writes a structured review artifact.
- Outputs `review.md` and `runtime-environment.txt`.
- Use when: you want review findings first and do not want to enter the fix loop yet.

## Parameters

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `BASE` | No | Base branch | `main` |
| `REVIEW_MODE` | No | `branch` / `staged` / `full` | `staged` |
| `OUTPUT_DIR` | No | Review artifact directory | `.codex/codex-review-fix/custom` |

## Examples

```text
/nova-plugin:codex-review-only BASE=main
```

```text
/nova-plugin:codex-review-only REVIEW_MODE=full
```

When invoked through the plugin, scripts should be called through `${CLAUDE_PLUGIN_ROOT}` instead of assuming the current repository contains `nova-plugin/`.

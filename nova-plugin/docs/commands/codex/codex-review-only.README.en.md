# /codex-review-only

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

## Examples

```text
/codex-review-only BASE=main
```

```text
/codex-review-only REVIEW_MODE=full
```

When invoked through the plugin, scripts should be called through `${CLAUDE_PLUGIN_ROOT}` instead of assuming the current repository contains `nova-plugin/`.

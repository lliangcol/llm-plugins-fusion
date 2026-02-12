---
name: nova-finalize-lite
description: "Minimal close-out summary: what changed, why, and known limitations."
user-invocable: true
auto-load: false
subagent-safe: true
destructive-actions: none
allowed-tools:
  - Read
  - Glob
  - Grep
  - LS
argument-hint: "Example: finalize-lite summarize this completed patch"
---

## Purpose

Provide a short and factual closure summary.

## Inputs

| Parameter    | Required | Default | Notes                     | Example                   |
| ------------ | -------- | ------- | ------------------------- | ------------------------- |
| `WORK_SCOPE` | Yes      | N/A     | Completed changes context | `Login refresh token fix` |

## Outputs

- `What changed`, `Why`, `Limitations (if any)`.

## Workflow

1. Freeze scope.
2. Summarize factual changes and motivation.
3. List known limits or `No known limitations`.

## Examples

- Natural trigger: `Use finalize-lite to close this small bugfix task.`
- Explicit trigger: `finalize-lite WORK_SCOPE="idempotency fix + tests"`.

## Safety

- No code/config modifications.
- No new decisions.

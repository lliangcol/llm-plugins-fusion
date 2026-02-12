---
name: nova-review-only
description: "Standard-depth review for correctness, performance, concurrency, failures, tests, and maintainability."
user-invocable: true
auto-load: false
subagent-safe: true
destructive-actions: none
allowed-tools:
  - Read
  - Glob
  - Grep
  - LS
argument-hint: "Example: review-only INPUT='payment callback module'"
---

## Purpose

Run regular strict review and output severity-grouped issues.

## Inputs

| Parameter | Required | Default | Notes                  | Example                   |
| --------- | -------- | ------- | ---------------------- | ------------------------- |
| `INPUT`   | Yes      | N/A     | Code/design/tests/logs | `fulfillment module diff` |

## Outputs

- `Critical`, `Major`, `Minor` findings.
- Each finding includes issue, impact, and directional improvement.

## Workflow

1. Review across standard dimensions.
2. Separate facts from assumptions.
3. Emit structured severity output.

## Examples

- Natural trigger: `Use review-only for this core path change.`
- Explicit trigger: `review-only INPUT="stock service patch"`.

## Safety

- No concrete code fixes.
- Do not expand scope beyond input.

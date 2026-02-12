---
name: nova-review-strict
description: "Exhaustive high-stakes review for production-critical code including boundary/security/data integrity concerns."
user-invocable: true
auto-load: false
subagent-safe: true
destructive-actions: none
allowed-tools:
  - Read
  - Glob
  - Grep
  - LS
argument-hint: "Example: review-strict INPUT='financial settlement diff'"
---

## Purpose

Perform production-critical audit with failure-cost awareness.

## Inputs

| Parameter | Required | Default | Notes                           | Example                    |
| --------- | -------- | ------- | ------------------------------- | -------------------------- |
| `INPUT`   | Yes      | N/A     | High-risk modules and refactors | `payment settlement logic` |

## Outputs

- `Critical`, `Major`, `Minor` findings with risk/cost reasoning.

## Workflow

1. Inspect required strict dimensions.
2. Justify why each issue matters.
3. Provide conceptual directional guidance only.

## Examples

- Natural trigger: `Use review-strict to audit this payment callback redesign.`
- Explicit trigger: `review-strict INPUT="state machine rewrite diff"`.

## Safety

- No code writing.
- Explicitly mark assumptions.

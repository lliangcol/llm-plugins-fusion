---
name: nova-plan-review
description: "Critically review a plan for decision clarity, assumptions, and execution risk without rewriting it."
user-invocable: true
auto-load: false
subagent-safe: true
destructive-actions: none
allowed-tools:
  - Read
  - Glob
  - Grep
  - LS
argument-hint: "Example: plan-review INPUT=docs/plans/order.md"
---

## Purpose

Assess plan quality and execution readiness from a reviewer perspective.

## Inputs

| Parameter | Required | Default | Notes             | Example                 |
| --------- | -------- | ------- | ----------------- | ----------------------- |
| `INPUT`   | Yes      | N/A     | Plan text or path | `docs/plans/payment.md` |

## Outputs

- `Decision clarity check`, `Assumptions & gaps`, `Risk signals`, `Review questions`.

## Workflow

1. Verify explicit goals/scope/decisions.
2. Identify assumptions and missing inputs.
3. Flag technical/operational risks.
4. Produce review questions only.

## Examples

- Natural trigger: `Use plan-review on this design draft.`
- Explicit trigger: `plan-review INPUT="docs/plans/refactor-auth.md"`.

## Safety

- No plan rewrite and no alternative design proposals.

---
name: nova-backend-plan
description: "Generate a Java/Spring backend design plan with mandatory 12 sections and write to PLAN_OUTPUT_PATH."
user-invocable: true
auto-load: false
subagent-safe: true
destructive-actions: low
allowed-tools:
  - Read
  - Glob
  - Grep
  - LS
  - Write
  - Edit
argument-hint: "Example: backend-plan PLAN_OUTPUT_PATH=docs/plans/order-refund.md"
---

## Purpose

Produce a complete Java/Spring backend design artifact for senior review.

## Inputs

| Parameter          | Required    | Default | Notes                       | Example                          |
| ------------------ | ----------- | ------- | --------------------------- | -------------------------------- |
| `PLAN_OUTPUT_PATH` | Yes         | N/A     | Required output path        | `docs/plans/payment-callback.md` |
| Business context   | Recommended | N/A     | Problem, goals, constraints | `Duplicate callback handling`    |

## Outputs

- Writes 12-section backend design doc to file.
- Chat output limited to path + 3-5 executive bullets.

## Workflow

1. Validate output path.
2. Extract assumptions and constraints.
3. Choose one design option with rejection rationale for alternatives.
4. Write full 12-section document.

## Examples

- Natural trigger: `Use backend-plan for this Java/Spring order refund flow.`
- Explicit trigger: `backend-plan PLAN_OUTPUT_PATH=docs/plans/refund-v2.md`.

## Safety

- No implementation code changes.
- Do not infer missing output path.

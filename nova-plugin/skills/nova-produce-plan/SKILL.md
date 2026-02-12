---
name: nova-produce-plan
description: "Write a formal plan document to file using general or java-backend profile; design checkpoint only."
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
argument-hint: "Example: produce-plan PLAN_OUTPUT_PATH=docs/plans/refund.md PLAN_INTENT=Fix idempotency PLAN_PROFILE=general"
---

## Purpose

Generate review-ready design/plan documentation based on intent and constraints.

## Inputs

| Parameter          | Required    | Default   | Notes                       | Example                     |
| ------------------ | ----------- | --------- | --------------------------- | --------------------------- |
| `PLAN_OUTPUT_PATH` | Yes         | N/A       | Output file path            | `docs/plans/refund.md`      |
| `PLAN_INTENT`      | Yes         | N/A       | Goal of this plan           | `Fix callback idempotency`  |
| `PLAN_PROFILE`     | No          | `general` | `general` or `java-backend` | `java-backend`              |
| `ANALYSIS_INPUTS`  | Recommended | N/A       | Prior analysis references   | `docs/analysis/callback.md` |
| `CONSTRAINTS`      | No          | N/A       | Boundaries                  | `Backward compatible`       |

## Outputs

- Writes full plan document to path (overwrite allowed, create parent dirs).
- Chat output only path + executive summary bullets.

## Workflow

1. Validate required fields.
2. Select profile template.
3. Produce complete plan with explicit trade-offs.
4. Write file and return constrained chat summary.

## Examples

- Natural trigger: `Use produce-plan to draft a formal plan for payment retry flow.`
- Explicit trigger: `produce-plan PLAN_OUTPUT_PATH=docs/plans/auth.md PLAN_INTENT=Unify auth chain PLAN_PROFILE=general`.

## Safety

- Design only, no code change.
- Stop when required fields are missing.

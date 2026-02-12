---
name: nova-implement-plan
description: "Implement strictly from an approved plan. Requires PLAN_INPUT_PATH and PLAN_APPROVED=true before execution."
user-invocable: true
auto-load: false
subagent-safe: true
destructive-actions: medium
allowed-tools:
  - Read
  - Glob
  - Grep
  - LS
  - Write
  - Edit
  - MultiEdit
  - Bash
argument-hint: "Example: implement-plan PLAN_INPUT_PATH=docs/plans/refund.md PLAN_APPROVED=true"
---

## Purpose

Execute approved plan steps with minimal deviation and clear traceability.

## Inputs

| Parameter         | Required | Default | Notes                  | Example                |
| ----------------- | -------- | ------- | ---------------------- | ---------------------- |
| `PLAN_INPUT_PATH` | Yes      | N/A     | Approved plan file     | `docs/plans/refund.md` |
| `PLAN_APPROVED`   | Yes      | N/A     | Must be exactly `true` | `true`                 |

## Outputs

- Code changes aligned to approved plan.
- Implementation summary + deviation notes.

## Workflow

1. Validate both required parameters.
2. Read plan as source of truth.
3. Implement step-by-step within scope.
4. Run plan-required verification.

## Examples

- Natural trigger: `Use implement-plan with the approved plan in docs/plans/login.md.`
- Explicit trigger: `implement-plan PLAN_INPUT_PATH=docs/plans/login.md PLAN_APPROVED=true`.

## Safety

- Medium-risk write operations.
- Stop on non-trivial deviation; request plan update.

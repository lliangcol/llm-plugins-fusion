---
name: nova-implement-standard
description: "Controlled implementation from confirmed steps/plan with minor corrective adjustments only."
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
argument-hint: "Example: implement-standard STEPS='A,B,C'"
---

## Purpose

Implement reliably with scoped execution discipline.

## Inputs

| Parameter     | Required | Default | Notes                      | Example                          |
| ------------- | -------- | ------- | -------------------------- | -------------------------------- |
| `STEPS/PLAN`  | Yes      | N/A     | Confirmed execution basis  | `1. Add cache key 2. Invalidate` |
| `CONSTRAINTS` | No       | N/A     | Compatibility/scope limits | `No public API change`           |

## Outputs

- Code updates.
- `Implementation Summary` + `Deviations (if any)`.

## Workflow

1. Confirm execution basis.
2. Implement in order.
3. Stop and report blocking issues.
4. Summarize outcomes and deviations.

## Examples

- Natural trigger: `Use implement-standard for this confirmed task breakdown.`
- Explicit trigger: `implement-standard STEPS="A->B->C" CONSTRAINTS="keep backward compatibility"`.

## Safety

- Medium-risk file modification.
- No scope expansion or redesign.

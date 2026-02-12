---
name: nova-plan-lite
description: "Lightweight planning skill for quick execution alignment; non-formal and no code writing."
user-invocable: true
auto-load: false
subagent-safe: true
destructive-actions: none
allowed-tools:
  - Read
  - Glob
  - Grep
  - LS
argument-hint: "Example: plan-lite for this feature request."
---

## Purpose

Create a short execution plan with clear scope and trade-offs.

## Inputs

| Parameter     | Required | Default | Notes                           | Example                   |
| ------------- | -------- | ------- | ------------------------------- | ------------------------- |
| `INPUT`       | Yes      | N/A     | Requirement/problem description | `Batch coupon expiration` |
| `CONSTRAINTS` | No       | N/A     | Timeline/compatibility limits   | `No API break`            |

## Outputs

- `Goal`, `Non-Goals`, `Chosen Approach`, `Key Trade-offs`, `Execution Outline`, `Key Risks`.

## Workflow

1. Clarify target and success criteria.
2. Lock non-goals.
3. Define high-level approach and trade-offs.
4. List key risks.

## Examples

- Natural trigger: `Run plan-lite for this small requirement.`
- Explicit trigger: `plan-lite INPUT="Fix overselling" CONSTRAINTS="No new middleware"`.

## Safety

- No production code.
- Explicitly mark assumptions when data is missing.

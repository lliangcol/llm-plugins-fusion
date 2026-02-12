---
name: nova-finalize-work
description: "Finalize completed work artifacts. Produce commit/PR text in Git repo, else local handoff summary and manual steps."
user-invocable: true
auto-load: false
subagent-safe: true
destructive-actions: none
allowed-tools:
  - Read
  - Glob
  - Grep
  - LS
  - Bash
argument-hint: "Example: finalize-work for current completed changes"
---

## Purpose

Package completed work into review-ready handoff artifacts without new changes.

## Inputs

| Parameter    | Required | Default         | Notes                           | Example                    |
| ------------ | -------- | --------------- | ------------------------------- | -------------------------- |
| `WORK_SCOPE` | Implicit | current context | Changes completed in prior step | `Refund retry fix + tests` |
| Git presence | Auto     | N/A             | Decide output mode A/B          | `git repository detected`  |

## Outputs

- Git mode: conventional commit message + PR description.
- Non-Git mode: local change summary + manual handoff/deploy steps.

## Workflow

1. Freeze current state.
2. Detect Git availability.
3. Generate corresponding artifact set.
4. Ensure mandatory sections are present.

## Examples

- Natural trigger: `Use finalize-work to prepare PR description for this feature.`
- Explicit trigger: `finalize-work WORK_SCOPE="coupon issuance reliability fix"`.

## Safety

- Read-only packaging.
- Follow-up items must be marked out-of-scope.

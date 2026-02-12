---
name: nova-implement-lite
description: "Fast pragmatic implementation for small tasks; allows minor adjustments but avoids overengineering."
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
argument-hint: "Example: implement-lite TASK='fix null pointer in order handler'"
---

## Purpose

Deliver quick, correct implementation for scoped changes.

## Inputs

| Parameter     | Required | Default | Notes                         | Example                      |
| ------------- | -------- | ------- | ----------------------------- | ---------------------------- |
| `TASK`        | Yes      | N/A     | Target implementation request | `Fix duplicate retry charge` |
| `CONSTRAINTS` | No       | N/A     | Scope boundaries              | `No schema migration`        |

## Outputs

- Implemented code changes.
- `Changes Summary` + `Adjustments (if any)`.

## Workflow

1. Clarify goal and acceptance.
2. Implement with minimal necessary edits.
3. Run focused validation.
4. Report summary and deviations.

## Examples

- Natural trigger: `Use implement-lite to quickly patch this bug.`
- Explicit trigger: `implement-lite TASK="Fix race in stock deduction" CONSTRAINTS="No refactor"`.

## Safety

- Medium-risk write operation.
- Avoid unrelated refactors.

---
name: nova-review-lite
description: "Quick lightweight review for obvious, high-signal issues in day-to-day PR checks."
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: review-lite INPUT='small PR diff'"
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: true
    destructiveActions: none
---

## Purpose

Deliver concise daily-review feedback with high signal and low friction.

## Inputs

| Parameter | Required | Default | Notes                        | Example                   |
| --------- | -------- | ------- | ---------------------------- | ------------------------- |
| `INPUT`   | Yes      | N/A     | Small diff/code/config/tests | `Controller + tests diff` |

## Outputs

- Bullet `Findings` list with optional tags.
- Or exact line: `No obvious issues found in this review scope.`

## Workflow

1. Scan correctness, obvious risk, readability red flags.
2. Keep findings concise and actionable.
3. Avoid architecture deep-dive.

## Examples

- Natural trigger: `Run review-lite on this small login PR.`
- Explicit trigger: `review-lite INPUT="patch for null checks"`.

## Safety

- No code edits.
- Scope is limited to provided input.

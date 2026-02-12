---
name: nova-explore-lite
description: "Lightweight observer-style exploration for quick understanding alignment."
user-invocable: true
auto-load: false
subagent-safe: true
destructive-actions: none
allowed-tools:
  - Read
  - Glob
  - Grep
  - LS
argument-hint: "Example: explore-lite on this log snippet."
---

## Purpose

Produce concise factual observations, uncertainties, and potential risks.

## Inputs

| Parameter | Required | Default | Notes                        | Example                 |
| --------- | -------- | ------- | ---------------------------- | ----------------------- |
| `INPUT`   | Yes      | N/A     | Requirement, code text, logs | `Order timeout logs...` |

## Outputs

- `Observations`, `Uncertainties`, `Potential risks`.

## Workflow

1. Extract verifiable facts.
2. Mark missing/ambiguous areas.
3. List risks from knowledge gaps.

## Examples

- Natural trigger: `Run explore-lite on this requirement.`
- Explicit trigger: `explore-lite INPUT="Error logs and stack trace"`.

## Safety

- No suggestions or design decisions.
- Do not fabricate missing facts.

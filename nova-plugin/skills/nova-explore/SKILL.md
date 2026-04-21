---
name: nova-explore
description: "Unified exploration Hub Skill. Route by PERSPECTIVE to observer/reviewer style outputs; analysis only, no design or implementation."
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: explore PERSPECTIVE=reviewer on this requirement doc."
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: true
    destructiveActions: none
---

## Purpose

Quickly align understanding and identify unknowns/risks without proposing solutions.

## Inputs

| Parameter     | Required | Default    | Notes                                | Example           |
| ------------- | -------- | ---------- | ------------------------------------ | ----------------- |
| `PERSPECTIVE` | No       | `observer` | `observer` or `reviewer`             | `reviewer`        |
| `INPUT`       | Yes      | N/A        | Requirement, diff, logs, design text | `PR diff text...` |

## Outputs

- `observer`: `Observations / Uncertainties / Potential risks`.
- `reviewer`: `What is clear / Review questions / Risk signals`.
- Chat output only.

## Workflow

1. Parse `PERSPECTIVE`.
2. Hub routing policy:

- `observer` -> `nova-explore-lite`
- `reviewer` -> `nova-explore-review`

3. Emit structured analysis output only.

## Examples

- Natural trigger: `Use explore to quickly align on this incident report.`
- Explicit trigger: `explore PERSPECTIVE=reviewer INPUT="Product requirement draft"`.

## Safety

- Do not provide solutions, implementation plans, or code.
- Separate facts from assumptions.

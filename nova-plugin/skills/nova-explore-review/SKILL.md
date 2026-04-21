---
name: nova-explore-review
description: "Reviewer-style exploration focused on questions and risk signals, without proposing fixes."
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: explore-review this design draft."
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: true
    destructiveActions: none
---

## Purpose

Apply reviewer mindset to surface clarity gaps and risk signals.

## Inputs

| Parameter | Required | Default | Notes                               | Example                       |
| --------- | -------- | ------- | ----------------------------------- | ----------------------------- |
| `INPUT`   | Yes      | N/A     | Requirement/design text, PR summary | `Architecture proposal draft` |

## Outputs

- `What is clear`, `Review questions`, `Risk signals`.

## Workflow

1. Split facts vs interpretation.
2. Ask correctness/scope/assumption questions.
3. Output risk signals only.

## Examples

- Natural trigger: `Use explore-review for this requirement doc.`
- Explicit trigger: `explore-review INPUT="Feature spec v3"`.

## Safety

- No redesign proposals.
- Stay within provided input scope.

---
name: nova-review
description: "Unified review Hub Skill. Route by LEVEL to standard or strict review outputs; no code modification."
user-invocable: true
auto-load: false
subagent-safe: true
destructive-actions: none
allowed-tools:
  - Read
  - Glob
  - Grep
  - LS
argument-hint: "Example: review LEVEL=strict INPUT='payment diff'"
---

## Purpose

Provide structured, severity-based review findings for code/design artifacts.

## Inputs

| Parameter | Required | Default    | Notes                  | Example                 |
| --------- | -------- | ---------- | ---------------------- | ----------------------- |
| `LEVEL`   | No       | `standard` | `standard` or `strict` | `strict`                |
| `INPUT`   | Yes      | N/A        | Review target content  | `PR diff / module code` |

## Outputs

- Severity buckets: `Critical`, `Major`, `Minor`.
- Directional suggestions only.

## Workflow

1. Parse level and target.
2. Hub routing policy:

- `standard` -> `nova-review-only`
- `strict` -> `nova-review-strict`

3. Emit findings with impact rationale.

## Examples

- Natural trigger: `Use review on this core module change.`
- Explicit trigger: `review LEVEL=standard INPUT="inventory service diff"`.

## Safety

- No implementation patches.
- Clearly label facts vs assumptions.

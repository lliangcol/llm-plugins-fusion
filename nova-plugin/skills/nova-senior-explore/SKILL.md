---
name: nova-senior-explore
description: "Deep exploration skill for complex requirements/incidents; can export analysis artifact identical to chat output."
user-invocable: true
auto-load: false
subagent-safe: true
destructive-actions: low
allowed-tools:
  - Read
  - Glob
  - Grep
  - LS
  - Write
argument-hint: "Example: senior-explore INTENT=incident DEPTH=deep EXPORT_PATH=docs/analysis/incident.md"
---

## Purpose

Conduct systematic analysis and surface findings/open questions/risks.

## Inputs

| Parameter     | Required | Default  | Notes                       | Example                         |
| ------------- | -------- | -------- | --------------------------- | ------------------------------- |
| `INTENT`      | Yes      | N/A      | Analysis intent             | `Investigate production issue`  |
| `CONTEXT`     | No       | N/A      | Logs, files, modules, docs  | `services/order/** + logs`      |
| `CONSTRAINTS` | No       | N/A      | Scope boundaries            | `Analyze current behavior only` |
| `DEPTH`       | No       | `normal` | `quick`/`normal`/`deep`     | `deep`                          |
| `EXPORT_PATH` | No       | N/A      | Optional artifact file path | `docs/analysis/auth.md`         |

## Outputs

- Chat: `Key findings / Open questions / Potential risks`.
- Optional file export with identical content.

## Workflow

1. Parse intent, scope, depth.
2. Analyze evidence and label assumptions.
3. Output fixed three-section structure.
4. If export path exists, write exact same content.

## Examples

- Natural trigger: `Use senior-explore to investigate this outage deeply.`
- Explicit trigger: `senior-explore INTENT=feature-feasibility DEPTH=quick EXPORT_PATH=docs/analysis/feasibility.md`.

## Safety

- Analysis only, no solutioning.
- Export must match chat output exactly.

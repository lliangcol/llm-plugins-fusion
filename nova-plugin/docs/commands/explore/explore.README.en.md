# /nova-plugin:explore

- Source: `nova-plugin/commands/explore.md`

## Command Positioning

- Unified exploration entry point for facts, uncertainties, and risk signals.
- Use when: quickly understanding requirements, incidents, logs, or code context.
- Not for: solution design, implementation, or refactoring proposals.

## Parameters

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `PERSPECTIVE` | No | `observer` / `reviewer`; default is `observer` | `reviewer` |
| `ARGUMENTS` | No | Any input context or problem description | `Requirement summary or logs` |

## Full Examples

```text
/nova-plugin:explore
We need to add a refund API. First list known facts, uncertainties, and potential risks.
```

```text
/nova-plugin:explore PERSPECTIVE=reviewer
Read this requirement as a reviewer and output only what is clear, review questions, and risk signals.
```

## Comparison with Similar Commands

- `/nova-plugin:explore-lite` is a lightweight observer-style scan.
- `/nova-plugin:explore-review` is reviewer-oriented exploration.
- `/nova-plugin:senior-explore` is deeper, more systematic, and can export an analysis artifact.


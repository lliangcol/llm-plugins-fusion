# /plan-lite
- Source: `nova-plugin/commands/plan-lite.md`

## Command Positioning
- Produce a lightweight execution plan with goals, boundaries, trade-offs, and high-level steps.
- Use when: quick execution path, no formal design doc.
- Not for: formal review-ready design docs or writing code.

## Parameters
| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `ARGUMENTS` | No | Requirement or context description. | `Goals and constraints` |

## Output
- Fixed output: Goal / Non-Goals / Chosen Approach / Key Trade-offs / Execution Outline / Key Risks.
- Example output structure:
```text
### Goal
- ...

### Non-Goals
- ...

### Chosen Approach
- ...

### Key Trade-offs
- ...

### Execution Outline
- ...

### Key Risks
- ...
```

## Full Examples
```text
/plan-lite
Goal: add points transfer
Constraint: no payment changes
```

```text
/plan-lite
Produce a lightweight plan based on prior analysis.
```

```text
/plan-lite
Provide detailed architecture design and implementation steps.
```

## Incorrect Usage / Anti-patterns
- Including production code or implementation details.
- Over-expanding scope or assuming unstated requirements.

## Comparison with Similar Commands
- `/produce-plan` writes a formal design document to a file.
- `/backend-plan` targets Java/Spring backend design.

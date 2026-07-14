# /nova-plugin:plan-lite

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `plan-lite`; stage: `plan`; canonical skill: `nova-produce-plan`
- Purpose: Create a short execution plan with explicit scope, trade-offs, and risks without writing code.
- Audience: `all-users`; support risk: `none`
- Inputs: `REQUEST` (required), `CONSTRAINTS`
- Output contract: `plan-lite-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `produce-plan`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/plan-lite.md`

## Command Positioning

- Produce a lightweight execution plan with goals, boundaries, trade-offs, and high-level steps.
- Use when: quick execution path, no formal design doc.
- Not for: formal review-ready design docs or writing code.

## Parameters

| Parameter   | Required | Description                         | Example                 |
| ----------- | -------- | ----------------------------------- | ----------------------- |
| `ARGUMENTS` | No       | Requirement or context description. | `Goals and constraints` |

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
/nova-plugin:plan-lite
Goal: add points transfer
Constraint: no payment changes
```

```text
/nova-plugin:plan-lite
Produce a lightweight plan based on prior analysis.
```

```text
/nova-plugin:plan-lite
Provide detailed architecture design and implementation steps.
```

## Incorrect Usage / Anti-patterns

- Including production code or implementation details.
- Over-expanding scope or assuming unstated requirements.

## Comparison with Similar Commands

- `/nova-plugin:produce-plan` writes a formal design document to a file.
- `/nova-plugin:backend-plan` targets Java/Spring backend design.

# /nova-plugin:implement-standard

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `implement-standard`; stage: `implement`; canonical skill: `nova-implement-plan`
- Purpose: Execute confirmed implementation steps reliably with controlled scope and validation.
- Audience: `all-users`; support risk: `medium`
- Inputs: `REQUEST` (required), `CONSTRAINTS`
- Output contract: `implementation-standard-v2`; authorization: `implementation`
- Effects: `shell`, `workspace-read`, `workspace-write`
- Related workflows: `implement-plan`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/implement-standard.md`

## Command Positioning

- Implement based on confirmed plans or clear steps with limited corrective adjustments.
- Use when: clear steps exist and controlled execution is needed.
- Not for: strict approved-plan execution or exploratory design.

## Parameters

| Parameter   | Required | Description                      | Example                   |
| ----------- | -------- | -------------------------------- | ------------------------- |
| `ARGUMENTS` | No       | Clear plan or step instructions. | `Step-by-step tasks list` |

## Output

- No fixed output structure specified; focus on implementing the given steps.
- Example output structure:

```text
(No fixed output structure specified)
```

## Full Examples

```text
/nova-plugin:implement-standard
Implement order cancellation per steps: 1) ... 2) ...
```

```text
/nova-plugin:implement-standard
Fix the bug based on the confirmed steps.
```

```text
/nova-plugin:implement-standard
Redesign the entire architecture and implement.
```

## Incorrect Usage / Anti-patterns

- Expanding scope without clear steps.
- Proceeding despite a blocking issue.

## Comparison with Similar Commands

- `/nova-plugin:implement-plan` requires PLAN_APPROVED=true.
- `/nova-plugin:implement-lite` is faster with fewer constraints.

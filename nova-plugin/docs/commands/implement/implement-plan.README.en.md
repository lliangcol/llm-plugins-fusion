# /nova-plugin:implement-plan

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `implement-plan`; stage: `implement`; canonical skill: `nova-implement-plan`
- Purpose: Execute an explicitly approved plan step by step with traceability and minimal deviation.
- Audience: `all-users`; support risk: `medium`
- Inputs: `PLAN_INPUT_PATH` (required), `PLAN_APPROVED` (required)
- Output contract: `implementation-plan-v2`; authorization: `implementation`
- Effects: `shell`, `workspace-read`, `workspace-write`
- Related workflows: `produce-plan`, `finalize-work`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/implement-plan.md`

## Command Positioning

- Implement strictly according to an approved plan with no arbitrary deviation.
- Use when: an approved plan exists and strict traceability is required.
- Not for: unapproved plans or exploratory design.

## Parameters

| Parameter         | Required | Description                      | Example                 |
| ----------------- | -------- | -------------------------------- | ----------------------- |
| `PLAN_INPUT_PATH` | Yes      | Path to the approved plan.       | `docs/plans/feature.md` |
| `PLAN_APPROVED`   | Yes      | Must be `true` (case-sensitive). | `true`                  |

## Output

- Chat output includes implemented changes, a short summary, and deviation notes (or explicit none).
- Example output structure:

```text
1. Implemented code changes
2. Short implementation summary
3. Deviation notes (or "No deviations from the approved plan")
```

## Full Examples

```text
/nova-plugin:implement-plan
PLAN_INPUT_PATH: docs/plans/feature.md
PLAN_APPROVED: true
```

```text
/nova-plugin:implement-plan
PLAN_INPUT_PATH: docs/plans/bugfix.md
PLAN_APPROVED: true
```

```text
/nova-plugin:implement-plan
PLAN_INPUT_PATH: docs/plans/feature.md
PLAN_APPROVED: false
```

## Incorrect Usage / Anti-patterns

- Proceeding without PLAN_APPROVED=true.
- Redesigning or expanding scope during execution.

## Comparison with Similar Commands

- `/nova-plugin:implement-standard` allows limited adjustments.
- `/nova-plugin:implement-lite` is faster with fewer constraints.

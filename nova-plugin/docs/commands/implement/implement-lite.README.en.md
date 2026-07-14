# /nova-plugin:implement-lite

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `implement-lite`; stage: `implement`; canonical skill: `nova-implement-plan`
- Purpose: Deliver a small bounded implementation with focused validation and no unrelated refactoring.
- Audience: `all-users`; support risk: `medium`
- Inputs: `REQUEST` (required), `CONSTRAINTS`
- Output contract: `implementation-lite-v2`; authorization: `implementation`
- Effects: `shell`, `workspace-read`, `workspace-write`
- Related workflows: `implement-plan`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/implement-lite.md`

## Command Positioning

- Fast, pragmatic implementation with small adjustments and minor refactors.
- Use when: small features or quick fixes with clear instructions.
- Not for: strict plan adherence or deep design.

## Parameters

| Parameter   | Required | Description                          | Example              |
| ----------- | -------- | ------------------------------------ | -------------------- |
| `ARGUMENTS` | No       | Implementation goal and constraints. | `Bugfix description` |

## Output

- No fixed output structure specified; focus on fast implementation.
- Example output structure:

```text
(No fixed output structure specified)
```

## Full Examples

```text
/nova-plugin:implement-lite
Quickly implement phone masking.
```

```text
/nova-plugin:implement-lite
Optimize enum lookup and add tests.
```

```text
/nova-plugin:implement-lite
Provide a full architecture design.
```

## Incorrect Usage / Anti-patterns

- Over-engineering or large refactors.
- Expanding beyond requirements.

## Comparison with Similar Commands

- `/nova-plugin:implement-standard` is more controlled with explicit steps.
- `/nova-plugin:implement-plan` must follow an approved plan.

# /nova-plugin:route

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `route`; stage: `explore`; canonical skill: `nova-route`
- Purpose: Choose the shortest safe next workflow route before execution starts.
- Audience: `all-users`; support risk: `none`
- Inputs: `REQUEST` (required), `DEPTH`
- Output contract: `recommended-route-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `explore`, `review`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/route.md`

## Command Positioning

- Read-only first-stage routing entry for choosing the next nova command, skill, core agent, and capability packs.
- Use when: the task is ambiguous, the starting command is unclear, or another tool needs to consume nova skills without Claude Code slash commands.
- Not for: direct implementation, plan writing, validation execution, or artifact creation.

## Parameters

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `REQUEST` | Yes | User request, task summary, issue, diff context, or workflow intent | `Fix CI failure and update docs` |
| `CONTEXT` | No | Optional context | `Current branch, plan file, diff summary` |
| `DEPTH` | No | `normal` / `brief`; default is `normal` | `brief` |

## Full Examples

```text
/nova-plugin:route
This task touches README, marketplace metadata, and release evidence. Which nova command should start?
```

```text
/nova-plugin:route CONTEXT="Cursor consuming nova skills"
The user asked for a medium-risk implementation, but there is no approved plan.
```

## Comparison with Similar Commands

- `/nova-plugin:explore` understands facts, unknowns, and risks; it does not choose a full workflow route.
- `/nova-plugin:produce-plan` writes a formal plan and needs clearer planning intent plus an output path.
- `/nova-plugin:route` only selects the next command and input requirements; it does not replace planning, review, or implementation.

## Route Families

| Intent | Default route |
| --- | --- |
| Understand facts, risks, or unknowns | `/nova-plugin:explore` or `/nova-plugin:senior-explore` |
| Produce a plan or design | `/nova-plugin:produce-plan`, `/nova-plugin:plan-lite`, or `/nova-plugin:backend-plan` |
| Review code, plans, or risk | `/nova-plugin:review`, `/nova-plugin:plan-review`, `/nova-plugin:codex-review-only`, or `/nova-plugin:codex-verify-only` |
| Modify project files | `/nova-plugin:implement-plan`, `/nova-plugin:implement-standard`, or `/nova-plugin:implement-lite` |
| Deliver a handoff or release summary | `/nova-plugin:finalize-work` or `/nova-plugin:finalize-lite` |
| Codex review/fix/verify loop | `/nova-plugin:codex-review-fix`, `/nova-plugin:codex-review-only`, or `/nova-plugin:codex-verify-only` |

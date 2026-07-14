# /nova-plugin:backend-plan

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `backend-plan`; stage: `plan`; canonical skill: `nova-produce-plan`
- Purpose: Produce a complete Java and Spring backend design artifact for senior review without implementing code.
- Audience: `backend-users`; support risk: `low`
- Inputs: `REQUEST` (required), `PLAN_OUTPUT_PATH` (required)
- Output contract: `backend-plan-v2`; authorization: `artifact-write`
- Effects: `artifact-write`, `workspace-read`, `workspace-write`
- Related workflows: `produce-plan`, `implement-plan`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/backend-plan.md`

## Command Positioning

- Produce a Java/Spring backend design plan written to a specified path.
- Use when: backend design documentation with consistency/concurrency focus.
- Not for: general/light plans or implementation.

## Parameters

| Parameter          | Required | Description                | Example                 |
| ------------------ | -------- | -------------------------- | ----------------------- |
| `PLAN_OUTPUT_PATH` | Yes      | Plan document output path. | `docs/plans/backend.md` |

## Output

- Write full plan to PLAN_OUTPUT_PATH; chat output only path and 3-bullet summary.
- Example output structure:

```text
Plan document structure:
1. Background & Problem Statement
2. Scope Definition
3. Business Rules & Invariants
4. Architecture Overview
5. Data Model & Persistence
6. Transaction & Consistency Design
7. Concurrency & Idempotency
8. Error Handling & Observability
9. Implementation Plan (Step-by-Step)
10. Testing Strategy
11. Rollback & Safety Plan
12. Risks & Open Questions
```

## Full Examples

```text
/nova-plugin:backend-plan
PLAN_OUTPUT_PATH: docs/plans/order-backend.md
```

```text
/nova-plugin:backend-plan
PLAN_OUTPUT_PATH: docs/plans/account-service.md
```

```text
/nova-plugin:backend-plan
Missing PLAN_OUTPUT_PATH
```

## Incorrect Usage / Anti-patterns

- Writing or modifying Java code.
- Skipping mandatory sections.

## Comparison with Similar Commands

- `/nova-plugin:produce-plan` is a general design document without Java/Spring-specific sections.
- `/nova-plugin:plan-lite` outputs only a lightweight plan.

# /backend-plan

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
/backend-plan
PLAN_OUTPUT_PATH: docs/plans/order-backend.md
```

```text
/backend-plan
PLAN_OUTPUT_PATH: docs/plans/account-service.md
```

```text
/backend-plan
Missing PLAN_OUTPUT_PATH
```

## Incorrect Usage / Anti-patterns

- Writing or modifying Java code.
- Skipping mandatory sections.

## Comparison with Similar Commands

- `/produce-plan` is a general design document without Java/Spring-specific sections.
- `/plan-lite` outputs only a lightweight plan.

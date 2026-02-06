# /produce-plan

- Source: `nova-plugin/commands/produce-plan.md`

## Command Positioning

- Produce a formal, review-ready planning and design document written to a specified path.
- Use when: formal plan for design review; explicit trade-offs and alternatives.
- Not for: lightweight planning or immediate implementation.

## Parameters

| Parameter          | Required | Description                                  | Example                           |
| ------------------ | -------- | -------------------------------------------- | --------------------------------- |
| `PLAN_OUTPUT_PATH` | Yes      | Plan document output path.                   | `docs/plans/feature.md`           |
| `PLAN_INTENT`      | Yes      | Plan intent and goal description.            | `Implement a specific feature`    |
| `ANALYSIS_INPUTS`  | No       | Referenced analysis artifacts (recommended). | `docs/analysis/feature.md`        |
| `CONSTRAINTS`      | No       | Constraints and decision boundaries.         | `Backward compatibility required` |

## Output

- Write full plan to PLAN_OUTPUT_PATH; chat output includes only the path and a 3-bullet executive summary.
- Example output structure:

```text
Plan document structure:
1. Background & Problem Statement
2. Goals & Non-Goals
3. Constraints & Assumptions
4. Alternatives Considered
5. Final Approach & Rationale
6. Step-by-Step Implementation Plan
7. Risks & Mitigations
8. Test & Validation Strategy
9. Rollback Strategy

Chat output:
<PLAN_OUTPUT_PATH>
- What is being done
- Why this approach was chosen
- Major risks or trade-offs
```

## Full Examples

```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/points-transfer.md
PLAN_INTENT: Implement points transfer
```

```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/payment-retry.md
PLAN_INTENT: Fix duplicate callback handling
ANALYSIS_INPUTS:
- docs/analysis/payment-retry.md
```

```text
/produce-plan
PLAN_INTENT: Missing PLAN_OUTPUT_PATH
```

## Incorrect Usage / Anti-patterns

- Proceeding without PLAN_OUTPUT_PATH.
- Pasting the full plan content into chat output.

## Comparison with Similar Commands

- `/plan-lite` outputs a lightweight plan without writing a file.
- `/backend-plan` targets Java/Spring backend design.

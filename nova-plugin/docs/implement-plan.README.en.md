# /implement-plan

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
/implement-plan
PLAN_INPUT_PATH: docs/plans/feature.md
PLAN_APPROVED: true
```

```text
/implement-plan
PLAN_INPUT_PATH: docs/plans/bugfix.md
PLAN_APPROVED: true
```

```text
/implement-plan
PLAN_INPUT_PATH: docs/plans/feature.md
PLAN_APPROVED: false
```

## Incorrect Usage / Anti-patterns

- Proceeding without PLAN_APPROVED=true.
- Redesigning or expanding scope during execution.

## Comparison with Similar Commands

- `/implement-standard` allows limited adjustments.
- `/implement-lite` is faster with fewer constraints.

# /implement-standard
- Source: `nova-plugin/commands/implement-standard.md`

## Command Positioning
- Implement based on confirmed plans or clear steps with limited corrective adjustments.
- Use when: clear steps exist and controlled execution is needed.
- Not for: strict approved-plan execution or exploratory design.

## Parameters
| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `ARGUMENTS` | No | Clear plan or step instructions. | `Step-by-step tasks list` |

## Output
- No fixed output structure specified; focus on implementing the given steps.
- Example output structure:
```text
(No fixed output structure specified)
```

## Full Examples
```text
/implement-standard
Implement order cancellation per steps: 1) ... 2) ...
```

```text
/implement-standard
Fix the bug based on the confirmed steps.
```

```text
/implement-standard
Redesign the entire architecture and implement.
```

## Incorrect Usage / Anti-patterns
- Expanding scope without clear steps.
- Proceeding despite a blocking issue.

## Comparison with Similar Commands
- `/implement-plan` requires PLAN_APPROVED=true.
- `/implement-lite` is faster with fewer constraints.

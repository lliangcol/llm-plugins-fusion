# /implement-lite

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
/implement-lite
Quickly implement phone masking.
```

```text
/implement-lite
Optimize enum lookup and add tests.
```

```text
/implement-lite
Provide a full architecture design.
```

## Incorrect Usage / Anti-patterns

- Over-engineering or large refactors.
- Expanding beyond requirements.

## Comparison with Similar Commands

- `/implement-standard` is more controlled with explicit steps.
- `/implement-plan` must follow an approved plan.

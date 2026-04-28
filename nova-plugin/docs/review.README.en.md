# /review

- Source: `nova-plugin/commands/review.md`

## Command Positioning

- Unified review entry point with standard and strict depth levels.
- Use when: reviewing code snippets, implementation notes, design fragments, or change descriptions.
- Not for: direct fixes, full implementations, or replacing human approval.

## Parameters

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `LEVEL` | No | `standard` / `strict`; default is `standard` | `strict` |
| `ARGUMENTS` | Yes | Content to review | `Code snippet or implementation notes` |

## Full Examples

```text
/review
Review this order-state transition implementation note: ...
```

```text
/review LEVEL=strict
Strictly review this payment callback code, focusing on concurrency, idempotency, and data integrity.
```

## Comparison with Similar Commands

- `/review-only` is equivalent to the standard-depth legacy entry point.
- `/review-strict` is equivalent to the strict audit entry point.
- `/review-lite` is lighter and is not part of the unified command depth switch.


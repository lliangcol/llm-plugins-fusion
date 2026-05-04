# /review

- Source: `nova-plugin/commands/review.md`

## Command Positioning

- Unified review entry point with lite, standard, and strict depth levels.
- Use when: reviewing code snippets, implementation notes, design fragments, or change descriptions.
- Not for: direct fixes, full implementations, or replacing human approval.

## Parameters

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `LEVEL` | No | `lite` / `standard` / `strict`; default is `standard` | `lite` |
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

```text
/review LEVEL=lite
Quickly review this small PR diff and report only high-signal issues.
```

## Comparison with Similar Commands

- `/review LEVEL=lite` is equivalent to the lightweight `/review-lite` entry point.
- `/review LEVEL=standard` is equivalent to the standard-depth `/review-only` entry point.
- `/review LEVEL=strict` is equivalent to the strict audit `/review-strict` entry point.

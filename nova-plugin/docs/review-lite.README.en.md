# /review-lite

- Source: `nova-plugin/commands/review-lite.md`

## Command Positioning

- Quick lightweight review focused on obvious issues.
- Use when: daily PR reviews, high-signal feedback.
- Not for: high-stakes audits or implementation proposals.

## Parameters

| Parameter   | Required | Description        | Example   |
| ----------- | -------- | ------------------ | --------- |
| `ARGUMENTS` | No       | Content to review. | `PR diff` |

## Output

- Findings list with optional tags; explicitly state none if no issues.
- Example output structure:

```text
### Findings
- [Bug] ...

No obvious issues found in this review scope.
```

## Full Examples

```text
/review-lite
Quickly review this PR diff: ...
```

```text
/review-lite
Any obvious risks in this logic?
```

```text
/review-lite
Provide a full refactor plan.
```

## Incorrect Usage / Anti-patterns

- Proposing large refactors.
- Writing or modifying code.

## Comparison with Similar Commands

- `/review-only` is more systematic.
- `/review-strict` is exhaustive for high risk.

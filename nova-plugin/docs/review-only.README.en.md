# /review-only
- Source: `nova-plugin/commands/review-only.md`

## Command Positioning
- Strict review grouped by severity with directional suggestions.
- Use when: systematic review of code or implementation descriptions.
- Not for: implementation code output or quick lightweight review.

## Parameters
| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `ARGUMENTS` | No | Content to review. | `Code snippets or implementation notes` |

## Output
- Grouped by Critical / Major / Minor with directional suggestions.
- Example output structure:
```text
### Critical
- Issue / Why / Directional suggestion

### Major
- ...

### Minor
- ...
```

## Full Examples
```text
/review-only
Review this code snippet: ...
```

```text
/review-only
Implementation description below, group findings by severity.
```

```text
/review-only
Provide full fix code.
```

## Incorrect Usage / Anti-patterns
- Providing implementation fixes.
- Expanding beyond provided scope.

## Comparison with Similar Commands
- `/review-lite` is lightweight.
- `/review-strict` is exhaustive for high risk.

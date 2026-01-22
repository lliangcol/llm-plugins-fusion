# /review-strict
- Source: `nova-plugin/commands/review-strict.md`

## Command Positioning
- Strict, exhaustive review for high-stakes or critical code.
- Use when: core module audits or pre-release reviews.
- Not for: lightweight daily reviews or implementation changes.

## Parameters
| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `ARGUMENTS` | No | Content to review. | `Core module code` |

## Output
- Grouped by Critical / Major / Minor with risk justification and directional suggestions.
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
/review-strict
Review payment core logic: ...
```

```text
/review-strict
Strict audit of concurrency-sensitive module.
```

```text
/review-strict
Fix and submit code changes.
```

## Incorrect Usage / Anti-patterns
- Providing implementation-level fixes.
- Missing risk justification or assumptions.

## Comparison with Similar Commands
- `/review-only` is medium intensity.
- `/review-lite` is lightweight.

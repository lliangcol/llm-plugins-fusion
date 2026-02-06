# /finalize-lite

- Source: `nova-plugin/commands/finalize-lite.md`

## Command Positioning

- Quick three-part summary of completed work.
- Use when: brief summary without full delivery artifacts.
- Not for: commit/PR packaging or full handoff docs.

## Parameters

| Parameter   | Required | Description         | Example          |
| ----------- | -------- | ------------------- | ---------------- |
| `ARGUMENTS` | No       | Scope to summarize. | `Change summary` |

## Output

- Output contains What changed / Why / Limitations.
- Example output structure:

```text
What changed: ...
Why: ...
Limitations: ...
```

## Full Examples

```text
/finalize-lite
Summarize this fix.
```

```text
/finalize-lite
Three-line summary of changes and limitations.
```

```text
/finalize-lite
Keep optimizing and change code.
```

## Incorrect Usage / Anti-patterns

- Introducing new decisions or changes.
- Missing one of the three parts.

## Comparison with Similar Commands

- `/finalize-work` outputs full delivery artifacts.

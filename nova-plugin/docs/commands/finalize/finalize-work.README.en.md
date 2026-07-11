# /nova-plugin:finalize-work

- Source: `nova-plugin/commands/finalize-work.md`

## Command Positioning

- Summarize and package completed work without new changes.
- Use when: commit/PR packaging or handoff summary is needed.
- Not for: ongoing changes or new decisions.

## Parameters

| Parameter    | Required | Description                                | Example                     |
| ------------ | -------- | ------------------------------------------ | --------------------------- |
| `WORK_SCOPE` | No       | Current completed change scope (implicit). | `Current workspace changes` |

## Output

- With Git: commit message + PR description; without Git: local summary + manual steps; must include change/why/limitations/follow-up.
- Example output structure:

```text
Case A (Git): commit message + PR description
Case B (No Git): local change summary + manual steps
```

## Full Examples

```text
/nova-plugin:finalize-work
Generate commit message and PR description.
```

```text
/nova-plugin:finalize-work
No Git project; provide handoff summary.
```

```text
/nova-plugin:finalize-work
Keep modifying code.
```

## Incorrect Usage / Anti-patterns

- Modifying code during finalization.
- Missing required sections.

## Comparison with Similar Commands

- `/nova-plugin:finalize-lite` outputs only a brief three-part summary.

# /senior-explore

- Source: `nova-plugin/commands/senior-explore.md`

## Command Positioning

- Deep analysis and understanding without proposing solutions.
- Use when: systematic analysis or risk identification; exportable analysis snapshots.
- Not for: design/implementation plans or code output.

## Parameters

| Parameter     | Required | Description                          | Example                               |
| ------------- | -------- | ------------------------------------ | ------------------------------------- |
| `INTENT`      | Yes      | Analysis intent.                     | `Analyze a new feature requirement`   |
| `CONTEXT`     | No       | Context materials.                   | `Logs and modules`                    |
| `CONSTRAINTS` | No       | Analysis boundaries and constraints. | `Only analyze current implementation` |
| `DEPTH`       | No       | Analysis depth.                      | `deep`                                |
| `EXPORT_PATH` | No       | Export path (identical to chat).     | `docs/analysis/issue.md`              |

## Output

- Fixed structure: Key findings / Open questions / Potential risks; optional export of identical content.
- Example output structure:

```text
### Key findings
- ...

### Open questions
- ...

### Potential risks
- ...
```

## Full Examples

```text
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT: Requirement doc and modules
```

```text
/senior-explore
INTENT: Investigate a production issue or bug
DEPTH: deep
EXPORT_PATH: docs/analysis/payment-issue.md
```

```text
/senior-explore
CONTEXT: Context only, no INTENT provided
```

## Incorrect Usage / Anti-patterns

- Asking for solutions or implementation steps.
- Using should/solution/implement wording.

## Comparison with Similar Commands

- `/explore-lite` is faster and lighter for quick alignment.
- `/explore-review` focuses on review questions and risk signals.

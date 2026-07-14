# /nova-plugin:senior-explore

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `senior-explore`; stage: `explore`; canonical skill: `nova-explore`
- Purpose: Conduct systematic analysis and optionally export an identical evidence-grounded analysis artifact.
- Audience: `advanced-users`; support risk: `low`
- Inputs: `INTENT` (required), `CONTEXT` (required), `CONSTRAINTS`, `DEPTH`, `EXPORT_PATH`
- Output contract: `senior-exploration-v2`; authorization: `artifact-write`
- Effects: `artifact-write`, `workspace-read`, `workspace-write`
- Related workflows: `explore`, `produce-plan`
<!-- generated:command-contract:end -->

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
| `DEPTH`       | No       | `quick` / `normal` / `deep`; default `normal`. | `deep`                     |
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
/nova-plugin:senior-explore
INTENT: Analyze a new feature requirement
CONTEXT: Requirement doc and modules
```

```text
/nova-plugin:senior-explore
INTENT: Investigate a production issue or bug
DEPTH: deep
EXPORT_PATH: docs/analysis/payment-issue.md
```

```text
/nova-plugin:senior-explore
CONTEXT: Context only, no INTENT provided
```

## Incorrect Usage / Anti-patterns

- Asking for solutions or implementation steps.
- Using should/solution/implement wording.

## Comparison with Similar Commands

- `/nova-plugin:explore-lite` is faster and lighter for quick alignment.
- `/nova-plugin:explore-review` focuses on review questions and risk signals.

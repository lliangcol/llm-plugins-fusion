# /nova-plugin:review-strict

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `review-strict`; stage: `review`; canonical skill: `nova-review`
- Purpose: Perform exhaustive production-critical review with explicit failure-cost reasoning and no implementation.
- Audience: `reviewers`; support risk: `none`
- Inputs: `REVIEW_SCOPE` (required)
- Output contract: `review-strict-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `review`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/review-strict.md`

## Command Positioning

- Strict, exhaustive review for high-stakes or critical code.
- Use when: core module audits or pre-release reviews.
- Not for: lightweight daily reviews or implementation changes.

## Parameters

| Parameter   | Required | Description        | Example            |
| ----------- | -------- | ------------------ | ------------------ |
| `ARGUMENTS` | No       | Content to review. | `Core module code` |

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
/nova-plugin:review-strict
Review payment core logic: ...
```

```text
/nova-plugin:review-strict
Strict audit of concurrency-sensitive module.
```

```text
/nova-plugin:review-strict
Fix and submit code changes.
```

## Incorrect Usage / Anti-patterns

- Providing implementation-level fixes.
- Missing risk justification or assumptions.

## Comparison with Similar Commands

- `/nova-plugin:review-only` is medium intensity.
- `/nova-plugin:review-lite` is lightweight.

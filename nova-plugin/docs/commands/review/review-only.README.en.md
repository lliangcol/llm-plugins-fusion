# /nova-plugin:review-only

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `review-only`; stage: `review`; canonical skill: `nova-review`
- Purpose: Perform standard evidence-grounded review and group findings by severity without implementation.
- Audience: `reviewers`; support risk: `none`
- Inputs: `REVIEW_SCOPE` (required)
- Output contract: `review-only-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `review`, `codex-review-only`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/review-only.md`

## Command Positioning

- Strict review grouped by severity with directional suggestions.
- Use when: systematic review of code or implementation descriptions.
- Not for: implementation code output or quick lightweight review.

## Parameters

| Parameter   | Required | Description        | Example                                 |
| ----------- | -------- | ------------------ | --------------------------------------- |
| `ARGUMENTS` | No       | Content to review. | `Code snippets or implementation notes` |

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
/nova-plugin:review-only
Review this code snippet: ...
```

```text
/nova-plugin:review-only
Implementation description below, group findings by severity.
```

```text
/nova-plugin:review-only
Provide full fix code.
```

## Incorrect Usage / Anti-patterns

- Providing implementation fixes.
- Expanding beyond provided scope.

## Comparison with Similar Commands

- `/nova-plugin:review-lite` is lightweight.
- `/nova-plugin:review-strict` is exhaustive for high risk.

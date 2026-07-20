# /nova-plugin:review-lite

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `review-lite`; stage: `review`; canonical skill: `nova-review`
- Purpose: Deliver concise daily-review feedback with high signal and bounded depth.
- Audience: `all-users`; support risk: `none`
- Inputs: `REVIEW_SCOPE` (required)
- Output contract: `review-lite-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `review`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/review-lite.md`

## Command Positioning

- Quick lightweight review focused on obvious issues.
- Use when: daily PR reviews, high-signal feedback.
- Not for: high-stakes audits or implementation proposals.

## Parameters

| Parameter   | Required | Description        | Example   |
| ----------- | -------- | ------------------ | --------- |
| `ARGUMENTS` | Yes      | Content to review. | `PR diff` |

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
/nova-plugin:review-lite
Quickly review this PR diff: ...
```

```text
/nova-plugin:review-lite
Any obvious risks in this logic?
```

```text
/nova-plugin:review-lite
Provide a full refactor plan.
```

## Incorrect Usage / Anti-patterns

- Proposing large refactors.
- Writing or modifying code.

## Comparison with Similar Commands

- `/nova-plugin:review-only` is more systematic.
- `/nova-plugin:review-strict` is exhaustive for high risk.

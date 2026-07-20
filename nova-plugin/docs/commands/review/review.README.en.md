# /nova-plugin:review

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `review`; stage: `review`; canonical skill: `nova-review`
- Purpose: Perform evidence-grounded code or design review at the requested depth and output mode without implementation.
- Audience: `all-users`; support risk: `none`
- Inputs: `REVIEW_SCOPE` (required), `LEVEL`, `MODE`, `REVIEW_PROFILE`
- Output contract: `review-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `review-lite`, `review-strict`
<!-- generated:command-contract:end -->

- Source: `nova-plugin/commands/review.md`

## Command Positioning

- Unified review entry point with lite, standard, and strict depth levels.
- Use when: reviewing code snippets, implementation notes, design fragments, or change descriptions.
- Not for: direct fixes, full implementations, or replacing human approval.

## Parameters

| Parameter | Required | Description | Example |
| --- | --- | --- | --- |
| `LEVEL` | No | `lite` / `standard` / `strict`; default is `standard` | `lite` |
| `ARGUMENTS` | Yes | Content to review | `Code snippet or implementation notes` |

## Full Examples

```text
/nova-plugin:review
Review this order-state transition implementation note: ...
```

```text
/nova-plugin:review LEVEL=strict
Strictly review this payment callback code, focusing on concurrency, idempotency, and data integrity.
```

```text
/nova-plugin:review LEVEL=lite
Quickly review this small PR diff and report only high-signal issues.
```

## Comparison with Similar Commands

- `/nova-plugin:review LEVEL=lite` is equivalent to the lightweight `/nova-plugin:review-lite` entry point.
- `/nova-plugin:review LEVEL=standard` is equivalent to the standard-depth `/nova-plugin:review-only` entry point.
- `/nova-plugin:review LEVEL=strict` is equivalent to the strict audit `/nova-plugin:review-strict` entry point.

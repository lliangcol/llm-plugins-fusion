---
name: nova-review-lite
description: "Quick lightweight review for obvious, high-signal issues in day-to-day PR checks."
license: MIT
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
metadata:
  nova-user-invocable: "true"
  nova-model-invocable: "true"
  nova-subagent-safe: "true"
  nova-destructive-actions: "none"
argument-hint: "Example: review-lite INPUT='small PR diff'"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:review-lite` and the deprecated `/nova-plugin:nova-review-lite` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

- Resolve natural-language and explicit `KEY=value` inputs using `../_shared/parameter-resolution.md`; explicit non-conflicting values take precedence.
- Apply `../_shared/safety-preflight.md` before side effects. Never infer approval, destructive scope, credentials, or output destinations.
- Follow `../_shared/output-contracts.md` and `../_shared/artifact-policy.md`; report completed, skipped, and blocked validation truthfully.
- Respect the frontmatter tool boundary. Missing inputs, unavailable dependencies, overlapping user changes, or repository-policy conflicts are blockers rather than permission to broaden scope.

## Execution

1. Parse `$ARGUMENTS` against the workflow-specific inputs below.
2. Read only the context required for the requested scope.
3. Apply the workflow contract and its strict output format.
4. Stop before unauthorized side effects; otherwise validate in proportion to risk and report residual risk.

## Workflow Contract

<!-- BEGIN GENERATED BEHAVIOR CONTRACT -->
> Generated from `workflow-specs/behaviors.json`. This block is authoritative. Run `node scripts/generate-behavior-surfaces.mjs --write` after changing the IR; if explanatory text below conflicts, fail closed.

### Generated Behavior Index

- **Purpose:** Deliver concise daily-review feedback with high signal and bounded depth.
- **Canonical inputs:** `REVIEW_SCOPE`(required aliases=INPUT,SCOPE)
- **Decision entries:** 2.
- **Workflow steps:** `scan` → `filter` → `emit`
- **Output:** mode=`chat`; order=`Findings`; severity=`Bug`, `Risk`, `Readability`, `Overengineering`.
- **Deviation/failure:** mode=`forbid`; failure order=`status` → `blocker` → `safe next action`.
- **Full IR:** `runtime/contracts/review-lite.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Deliver concise daily-review feedback with high signal and low friction.

### Inputs

| Parameter | Required | Default | Notes                        | Example                   |
| --------- | -------- | ------- | ---------------------------- | ------------------------- |
| `INPUT`   | Yes      | N/A     | Small diff/code/config/tests | `Controller + tests diff` |

### Outputs

- Bullet `Findings` list with optional tags.
- Or exact line: `No obvious issues found in this review scope.`

### Workflow

1. Scan correctness, obvious risk, readability red flags.
2. Keep findings concise and actionable.
3. Avoid architecture deep-dive.

### Examples

- Natural trigger: `Run review-lite on this small login PR.`
- Explicit trigger: `review-lite INPUT="patch for null checks"`.

### Safety

- No code edits.
- Scope is limited to provided input.

## Detailed Contract

### LIGHTWEIGHT REVIEW

TASK: LIGHT REVIEW - NO IMPLEMENTATION

You are Claude Code acting as a **pragmatic reviewer**.

This command is for **quick, lightweight review**.
Focus on obvious issues and high-signal feedback.
You MUST NOT write or modify code.

---

#### INPUT

Review the following:

$ARGUMENTS

Input may include:

- Small code changes
- PR diffs
- Logic descriptions
- Tests or configs

Assume:

- This is part of ongoing development
- Perfection is NOT the goal

---

#### REVIEW FOCUS (LIMITED SCOPE)

Focus ONLY on:

- Obvious correctness issues
- Clear logic bugs or edge cases
- Overengineering that is immediately visible
- Readability or maintainability red flags
- Dangerous patterns (nulls, concurrency misuse, silent failures)

DO NOT deep dive into:

- Architecture redesign
- Hypothetical future scaling
- Micro-optimizations

---

#### STRICT RULES

You MUST:

- Keep feedback concise
- Prefer high-signal findings over completeness

You MUST NOT:

- Write code
- Propose large refactors
- Expand scope beyond provided input

---

#### OUTPUT FORMAT

##### Findings

Use bullet points.
Each point should be short and actionable.

If applicable, prefix with:

- `[Bug]`
- `[Risk]`
- `[Readability]`
- `[Overengineering]`

Example:

- `[Bug]` Null handling is missing when xxx is empty
- `[Risk]` Shared mutable state may cause issues under concurrency

If no issues are found:

- Explicitly state: **"No obvious issues found in this review scope."**

---

#### TONE

- Friendly
- Direct
- Low-friction
- Suitable for daily PR review

---

#### END OF COMMAND

---
name: nova-explore-review
description: "Reviewer-style exploration focused on questions and risk signals, without proposing fixes."
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
argument-hint: "Example: explore-review this design draft."
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:explore-review` and the deprecated `/nova-plugin:nova-explore-review` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

- **Purpose:** Surface clarity gaps and risk signals using a reviewer perspective without proposing solutions.
- **Canonical inputs:** `INPUT`(required aliases=REQUEST,CONTEXT)
- **Decision entries:** 1.
- **Workflow steps:** `separate-evidence` → `ask-questions` → `identify-signals`
- **Output:** mode=`chat`; order=`What is clear` → `Review questions` → `Risk signals`; severity=none.
- **Deviation/failure:** mode=`forbid`; failure order=`status` → `missing input` → `safe next action`.
- **Full IR:** `runtime/contracts/explore-review.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Apply reviewer mindset to surface clarity gaps and risk signals.

### Inputs

| Parameter | Required | Default | Notes                               | Example                       |
| --------- | -------- | ------- | ----------------------------------- | ----------------------------- |
| `INPUT`   | Yes      | N/A     | Requirement/design text, PR summary | `Architecture proposal draft` |

### Outputs

- `What is clear`, `Review questions`, `Risk signals`.

### Workflow

1. Split facts vs interpretation.
2. Ask correctness/scope/assumption questions.
3. Output risk signals only.

### Examples

- Natural trigger: `Use explore-review for this requirement doc.`
- Explicit trigger: `explore-review INPUT="Feature spec v3"`.

### Safety

- No redesign proposals.
- Stay within provided input scope.

## Detailed Contract

### REVIEW WITHOUT SOLUTIONS

You are Claude Code acting as a senior reviewer / tech lead.

This command simulates a **review mindset**:

- Observe
- Question
- Identify risks

---

#### EXECUTION RULES

- Do NOT provide solutions, fixes, or recommendations
- Do NOT write or modify code
- Do NOT suggest specific technologies or implementations

Language constraints:

- Avoid words like: "should", "recommend", "solution", "implement"
- Prefer: "appears", "may indicate", "is unclear"

---

#### OUTPUT FORMAT (STRICT)

##### What is clear

- Confirmed understanding based on provided input
- Explicitly separate facts from interpretations

##### Review questions

- Questions a reviewer would raise
- Focus on correctness, clarity, and assumptions
- Avoid hypothetical redesign questions

##### Risk signals

- Correctness risks
- Boundary or edge-case risks
- Operational or maintenance risks
- No mitigation or next steps

---

#### END OF COMMAND

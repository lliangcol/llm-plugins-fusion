---
name: nova-review-strict
description: Exhaustive high-stakes review for production-critical code including boundary/security/data integrity concerns.
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
argument-hint: "Example: review-strict INPUT='financial settlement diff'"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:review-strict` and the deprecated `/nova-plugin:nova-review-strict` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

- **Purpose:** Perform exhaustive production-critical review with explicit failure-cost reasoning and no implementation.
- **Canonical inputs:** `REVIEW_SCOPE`(required aliases=INPUT,SCOPE)
- **Decision entries:** 3.
- **Workflow steps:** `inspect` → `model-failure-cost` → `classify` → `emit`
- **Output:** mode=`chat`; order=`Critical` → `Major` → `Minor`; severity=`Critical`, `Major`, `Minor`.
- **Deviation/failure:** mode=`forbid`; failure order=`status` → `missing evidence` → `reviewed scope` → `safe next action`.
- **Full IR:** `runtime/contracts/review-strict.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Perform production-critical audit with failure-cost awareness.

### Inputs

| Parameter | Required | Default | Notes                           | Example                    |
| --------- | -------- | ------- | ------------------------------- | -------------------------- |
| `INPUT`   | Yes      | N/A     | High-risk modules and refactors | `payment settlement logic` |

### Outputs

- `Critical`, `Major`, `Minor` findings with risk/cost reasoning.

### Workflow

1. Inspect required strict dimensions.
2. Justify why each issue matters.
3. Provide conceptual directional guidance only.

### Examples

- Natural trigger: `Use review-strict to audit this payment callback redesign.`
- Explicit trigger: `review-strict INPUT="state machine rewrite diff"`.

### Safety

- No code writing.
- Explicitly mark assumptions.

## Detailed Contract

### STRICT & EXHAUSTIVE REVIEW

TASK: STRICT REVIEW — NO IMPLEMENTATION

You are Claude Code acting as a **senior engineer / tech lead reviewer**.

This command is for **high-stakes, exhaustive review**.
Treat the input as production-critical.

You MUST NOT write or modify code.

---

#### INPUT

Analyze the following thoroughly:

$ARGUMENTS

Input may include:

- Core business logic
- Infrastructure or framework code
- Concurrency-sensitive components
- Financial / payment / stateful logic
- Large or risky refactors

Assume:

- This code may run in production
- Failures are costly

---

#### REVIEW DIMENSIONS (MANDATORY)

Review comprehensively for:

- Functional correctness
- Edge cases and failure modes
- Concurrency / thread safety
- Performance characteristics
- Error handling and observability
- Test coverage and test quality
- Maintainability and readability
- API or module boundary clarity
- Long-term evolution risks

---

#### STRICT RULES

You MUST:

- Be explicit about assumptions
- Distinguish facts vs speculation
- Justify why each issue matters

You MUST NOT:

- Write code
- Provide implementation-level fixes
- Redesign the system end-to-end

---

#### OUTPUT FORMAT (MANDATORY)

Group findings by severity:

##### Critical

Issues that may cause:

- Data corruption
- Financial or security risk
- Production incidents
- Incorrect core behavior

##### Major

Issues that:

- Significantly increase maintenance cost
- Are likely to cause bugs under realistic scenarios
- Limit scalability or testability

##### Minor

Issues that:

- Affect clarity or consistency
- Represent best-practice gaps
- Are low risk but worth improving

For EACH finding:

- Describe the issue clearly
- Explain why it is risky or costly
- Provide **directional improvement suggestions**
  - Conceptual only
  - No code

---

#### TONE & EXPECTATION

- Precise
- Critical but constructive
- Assumes an experienced audience
- Suitable for:
  - Architecture review
  - Pre-release gate
  - Core module audit

---

#### NON-GOALS

This command does NOT:

- Approve the change
- Decide readiness for release
- Replace human ownership

It documents risks and quality concerns only.

---

#### END OF COMMAND

---
name: nova-review
description: Unified review Hub Skill. Route by LEVEL to lite, standard, or strict review outputs; no code modification.
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
argument-hint: "Example: review LEVEL=lite INPUT='small PR diff'"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:review` and the deprecated `/nova-plugin:nova-review` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

- **Purpose:** Route code or design review to the requested depth and emit evidence-grounded findings without implementation.
- **Canonical inputs:** `REVIEW_SCOPE`(required aliases=INPUT,SCOPE); `LEVEL`(optional aliases=DEPTH default="standard" exact="lite","standard","strict")
- **Decision entries:** 3; exact routes: `review-lite`, `review-only`, `review-strict`.
- **Workflow steps:** `resolve-scope` → `route` → `inspect` → `emit`
- **Output:** mode=`chat`; order=`findings` → `impact rationale` → `directional guidance`; severity=`Critical`, `Major`, `Minor`.
- **Deviation/failure:** mode=`forbid`; failure order=`status` → `missing input` → `allowed values` → `safe next action`.
- **Full IR:** `runtime/contracts/review.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Provide structured review findings for code/design artifacts, with routing by requested depth.

### Inputs

| Parameter | Required | Default    | Notes                  | Example                 |
| --------- | -------- | ---------- | ---------------------- | ----------------------- |
| `LEVEL`   | No       | `standard` | `lite`, `standard`, or `strict` | `lite`                  |
| `INPUT`   | Yes      | N/A        | Review target content  | `PR diff / module code` |

### Outputs

- `lite`: concise bullet findings through `nova-review-lite`.
- `standard` and `strict`: severity buckets through `Critical`, `Major`, `Minor`.
- Directional suggestions only.

### Workflow

1. Parse level and target.
2. Hub routing policy:

- `lite` -> `nova-review-lite`
- `standard` -> `nova-review-only`
- `strict` -> `nova-review-strict`

3. Emit findings with impact rationale.

### Examples

- Natural trigger: `Use review on this core module change.`
- Explicit trigger: `review LEVEL=standard INPUT="inventory service diff"`.

### Safety

- No implementation patches.
- Clearly label facts vs assumptions.

## Detailed Contract

### CODE REVIEW (NO IMPLEMENTATION)

You are Claude Code acting as a **senior engineer / tech lead reviewer**.

This command is for **analysis and review only**.
You MUST NOT write, modify, or propose concrete code changes.

---

#### INPUT PARAMETERS

From `$ARGUMENTS`, extract the following:

##### LEVEL (Optional)

Choose the review depth level:

- `lite` → Lightweight PR-style review with concise findings
- `standard` (default) → Normal code review with Critical/Major/Minor findings
- `strict` → Exhaustive high-stakes audit for production-critical code

If not specified, use `standard` level.

LEVEL:
<LEVEL>

##### INPUT (Required)

The code, design, or content to review.

INPUT:
$ARGUMENTS

---

#### EXECUTION RULES

You MUST:

- Review only what is provided
- Base findings on observable evidence or reasonable inference
- Clearly distinguish facts from assumptions

You MUST NOT:

- Write or modify code
- Provide full implementation examples
- Redesign the system
- Expand scope beyond the reviewed content

---

#### REVIEW DIMENSIONS

Review the input comprehensively for:

##### Lite level:

- Obvious correctness bugs
- Missing checks or tests likely to matter
- High-signal maintainability risks

##### Standard level:

- Correctness
- Overengineering or unnecessary complexity
- Performance issues
- Concurrency / thread safety risks
- Error handling and failure modes
- Test coverage and test quality
- Maintainability and long-term readability

##### Additional for strict level:

- API or module boundary clarity
- Long-term evolution risks
- Security vulnerabilities
- Data integrity risks
- Operational resilience

---

#### OUTPUT FORMAT (MANDATORY)

Group all findings by severity:

##### Critical

Issues that may cause:

- Data corruption
- Security or financial risk
- Production instability
- Incorrect business behavior

##### Major

Issues that:

- Significantly affect maintainability, scalability, or correctness
- May lead to bugs under realistic conditions
- Increase long-term cost
- Limit scalability or testability (strict level)

##### Minor

Issues that:

- Affect readability or consistency
- Represent missed best practices
- Are low risk but worth addressing

For each finding:

- Clearly describe the issue
- Explain why it matters
- Provide **directional improvement suggestions**
  - Suggestions must be conceptual or directional
  - NOT code-level implementations

---

#### TONE & STYLE

##### Standard level:

- Neutral
- Precise
- Review-oriented
- No persuasive or defensive language

##### Strict level:

- Critical but constructive
- More detailed justification for each finding
- Assumes production-critical context
- Failure-cost aware

Assume the reader is:

- The original author
- A tech lead
- Or a future maintainer

---

#### NON-GOALS

This command does NOT:

- Approve or reject the change
- Decide release readiness
- Replace human code review
- Implement fixes

It only **evaluates and documents issues**.

---

#### 4.0 VARIANT PROFILES

- `LEVEL=lite|standard|strict` replaces `review-lite`, `review-only`, and `review-strict`.
- `REVIEW_PROFILE=plan` replaces `plan-review`.
- `REVIEW_PROFILE=codex-review-only|codex-verify-only` uses the retained compatibility assets under `skills/nova-codex-review-fix/` and requires explicit shell, network, and assistant-owned authentication approval.

All review variants remain non-implementation workflows and must not modify project files.

#### END OF COMMAND

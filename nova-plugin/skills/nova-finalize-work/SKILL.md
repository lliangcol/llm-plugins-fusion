---
name: nova-finalize-work
description: "Finalize completed work artifacts. Produce commit/PR text in Git repo, else local handoff summary and manual steps."
license: MIT
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
disable-model-invocation: false
compatibility: "Designed for Claude Code; optional read-only Git inspection through Bash follows the normal permission flow."
metadata:
  nova-user-invocable: "true"
  nova-model-invocable: "true"
  nova-subagent-safe: "true"
  nova-destructive-actions: "none"
argument-hint: "Example: finalize-work for current completed changes"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:finalize-work` and the deprecated `/nova-plugin:nova-finalize-work` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

- **Purpose:** Package completed work into review-ready handoff text without changing the completed state.
- **Canonical inputs:** `WORK_SUMMARY`(required aliases=WORK_SCOPE)
- **Decision entries:** 2.
- **Workflow steps:** `freeze-state` → `detect-mode` → `package` → `verify-sections`
- **Output:** mode=`chat`; order=`title or commit message` → `change summary` → `validation` → `handoff` → `out-of-scope follow-up`; severity=none.
- **Deviation/failure:** mode=`forbid`; failure order=`status` → `missing evidence` → `available handoff` → `safe next action`.
- **Full IR:** `runtime/contracts/finalize-work.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Package completed work into review-ready handoff artifacts without new changes.

### Inputs

| Parameter    | Required | Default         | Notes                           | Example                    |
| ------------ | -------- | --------------- | ------------------------------- | -------------------------- |
| `WORK_SCOPE` | Implicit | current context | Changes completed in prior step | `Refund retry fix + tests` |
| Git presence | Auto     | N/A             | Decide output mode A/B          | `git repository detected`  |

### Outputs

- Git mode: conventional commit message + PR description.
- Non-Git mode: local change summary + manual handoff/deploy steps.

### Workflow

1. Freeze current state.
2. Detect Git availability.
3. Generate corresponding artifact set.
4. Ensure mandatory sections are present.

### Examples

- Natural trigger: `Use finalize-work to prepare PR description for this feature.`
- Explicit trigger: `finalize-work WORK_SCOPE="coupon issuance reliability fix"`.

### Safety

- Read-only packaging.
- Follow-up items must be marked out-of-scope.

## Detailed Contract

### Complete the work results

#### TASK: FINALIZE WORK ARTIFACTS

You are **Claude Code**, acting as a **disciplined senior engineer** responsible for closing a unit of work in a **review-ready, handoff-ready** state.

This step is **purely summarization and packaging**.
No new decisions, no new changes.

---

#### REQUIRED INPUTS

From `$ARGUMENTS`, infer:

- `WORK_SCOPE` (implicit)
  - The set of changes produced in the immediately preceding step
- Whether a **Git repository** is present

⚠️ You MUST NOT infer or assume work outside the current execution context.

---

#### EXECUTION RULES

1. **DO NOT** modify any code, configuration, or documents
2. **DO NOT** redesign, refactor, or extend scope
3. **DO NOT** introduce new decisions
4. Treat the current working state as **final and frozen**

This step is about **describing what exists**, not improving it.

---

#### OUTPUT MODE DECISION

##### Case A — Git repository is present

You MUST generate:

1. **A conventional commit message**
   - Follows `type(scope): summary`
   - Reflects actual changes only
   - No speculative or future-looking language

2. **A pull request description**, including:
   - What was changed
   - Why it was changed
   - How it aligns with the approved plan (if applicable)
   - Known limitations
   - Follow-up work (explicitly marked as out-of-scope)

---

##### Case B — Git repository is NOT present

You MUST generate:

1. **A local change summary**, suitable for:
   - Manual review
   - Handoff to another engineer
   - Inclusion in internal documentation

2. **Manual deployment or handoff steps**, if applicable
   - Only steps required to apply or verify the existing changes
   - No new setup or optimization steps

---

#### REQUIRED CONTENT (ALWAYS)

Regardless of Git availability, the output MUST explicitly include:

##### 1. What was changed

- High-level, factual description
- No implementation speculation

##### 2. Why it was changed

- Business, technical, or operational motivation
- Should trace back to:
  - The original problem
  - Or an approved plan

##### 3. Known limitations

- Edge cases
- Trade-offs
- Intentional exclusions

##### 4. Follow-up work (if any)

- Clearly labeled as **NOT part of this change**
- Suitable for future tickets or plans

---

#### STYLE & TONE REQUIREMENTS

- Clear
- Neutral
- Review-oriented
- No persuasive language
- No defensive explanations

Assume the reader is:

- A reviewer
- A tech lead
- Or a future maintainer

---

#### NON-GOALS (Explicitly Out of Scope)

This command does NOT:

- Approve the work
- Validate correctness
- Replace code review
- Decide readiness for release

It only **packages the outcome** of prior steps.

---

#### POSITION IN THE OVERALL FLOW

This command is the **final step** after implementation is complete:

1. **Explore** → Understand the problem
2. **Plan** → Design the solution
3. **Review** → Validate the approach
4. **Implement** → Execute the changes
5. **Finalize** ← **(YOU ARE HERE)** → Package and document the completed work

---

#### END OF COMMAND

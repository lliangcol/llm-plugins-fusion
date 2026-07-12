---
name: nova-backend-plan
description: Generate a Java/Spring backend design plan with mandatory 12 sections and write to PLAN_OUTPUT_PATH.
license: MIT
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit Bash
user-invocable: true
disable-model-invocation: true
metadata:
  nova-user-invocable: "true"
  nova-model-invocable: "false"
  nova-subagent-safe: "true"
  nova-destructive-actions: "low"
argument-hint: "Example: backend-plan PLAN_OUTPUT_PATH=docs/plans/order-refund.md"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:backend-plan` and the deprecated `/nova-plugin:nova-backend-plan` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

- **Purpose:** Produce a complete Java and Spring backend design artifact for senior review without implementing code.
- **Canonical inputs:** `REQUEST`(required aliases=BUSINESS_CONTEXT,PLAN_INTENT); `PLAN_OUTPUT_PATH`(required aliases=OUTPUT_PATH)
- **Decision entries:** 1.
- **Workflow steps:** `validate-inputs` → `extract-constraints` → `select-design` → `write-plan`
- **Output:** mode=`artifact`; order=`artifact path` → `executive summary`; severity=none.
- **Deviation/failure:** mode=`approval-required`; failure order=`status` → `blocker` → `required input` → `safe next action`.
- **Full IR:** `runtime/contracts/backend-plan.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Produce a complete Java/Spring backend design artifact for senior review.

### Inputs

| Parameter          | Required    | Default | Notes                       | Example                          |
| ------------------ | ----------- | ------- | --------------------------- | -------------------------------- |
| `PLAN_OUTPUT_PATH` | Yes         | N/A     | Required output path        | `docs/plans/payment-callback.md` |
| Business context   | Recommended | N/A     | Problem, goals, constraints | `Duplicate callback handling`    |

### Outputs

- Writes 12-section backend design doc to file.
- Chat output limited to path + 3-5 executive bullets.

### Workflow

1. Validate output path.
2. Extract assumptions and constraints.
3. Choose one design option with rejection rationale for alternatives.
4. Write full 12-section document.

### Examples

- Natural trigger: `Use backend-plan for this Java/Spring order refund flow.`
- Explicit trigger: `backend-plan PLAN_OUTPUT_PATH=docs/plans/refund-v2.md`.

### Safety

- No implementation code changes.
- Do not infer missing output path.

## Detailed Contract

### JAVA / SPRING BACKEND DESIGN PLAN

TASK: PRODUCE A JAVA / SPRING BACKEND DESIGN PLAN

You are Claude Code acting as a **senior Java backend engineer / system designer**.

Think carefully. Design decisions here will directly guide implementation.

---

#### REQUIRED INPUT EXTRACTION

From `$ARGUMENTS`, extract:

#### 1. PLAN_OUTPUT_PATH (Required)

PLAN_OUTPUT_PATH:
<PLAN_OUTPUT_PATH>

If PLAN_OUTPUT_PATH is missing:

- STOP immediately
- Ask the user to explicitly provide it

You MUST NOT guess or invent a path.

---

#### GENERAL RULES (STRICT)

- DO NOT write or modify any Java code
- This step is DESIGN ONLY
- DO NOT assume implementation details not justified by the problem
- DO NOT over-optimize or design speculative features

You MUST:

- Write a COMPLETE design plan to PLAN_OUTPUT_PATH
- Overwrite the file if it already exists
- Create parent directories if missing
- Assume the plan will be reviewed by senior engineers and tech leads

---

#### PLAN DOCUMENT STRUCTURE (MANDATORY)

1️⃣ Background & Problem Statement
2️⃣ Scope Definition
3️⃣ Business Rules & Invariants
4️⃣ Architecture Overview
5️⃣ Data Model & Persistence
6️⃣ Transaction & Consistency Design
7️⃣ Concurrency & Idempotency
8️⃣ Error Handling & Observability
9️⃣ Implementation Plan (Step-by-Step)
🔟 Testing Strategy
1️⃣1️⃣ Rollback & Safety Plan
1️⃣2️⃣ Risks & Open Questions

Each section MUST be explicitly present.
Use "N/A" if a section truly does not apply.

---

#### DESIGN QUALITY BAR

The plan MUST be:

- Internally consistent
- Explicit about assumptions
- Clear about trade-offs
- Safe-by-default

If multiple design options exist:

- Choose ONE
- Briefly justify why alternatives were rejected

---

#### OUTPUT RULES

You MUST:

- Write the FULL plan to PLAN_OUTPUT_PATH

In chat output ONLY:

- The file path written
- 3–5 bullet executive summary

You MUST NOT:

- Paste the full plan into chat
- Start implementation
- Suggest future improvements

---

#### END OF COMMAND

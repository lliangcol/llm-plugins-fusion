---
name: nova-implement-plan
description: Implement strictly from an approved plan. Requires PLAN_INPUT_PATH and PLAN_APPROVED=true before execution.
license: MIT
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit
user-invocable: true
disable-model-invocation: true
compatibility: "Designed for Claude Code; project validation through Bash follows the normal permission flow."
metadata:
  nova-user-invocable: "true"
  nova-model-invocable: "false"
  nova-subagent-safe: "true"
  nova-destructive-actions: "medium"
argument-hint: "Example: implement-plan PLAN_INPUT_PATH=docs/plans/refund.md PLAN_APPROVED=true"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:implement-plan` and the deprecated `/nova-plugin:nova-implement-plan` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

- **Purpose:** Execute an explicitly approved plan step by step with traceability and minimal deviation.
- **Canonical inputs:** `PLAN_INPUT_PATH`(required aliases=PLAN_PATH); `PLAN_APPROVED`(required aliases=APPROVED exact=true,"true")
- **Decision entries:** 2.
- **Workflow steps:** `validate-approval` → `load-plan` → `execute` → `verify` → `trace`
- **Output:** mode=`workspace-and-chat`; order=`plan-step trace` → `validation` → `deviations`; severity=none.
- **Deviation/failure:** mode=`approval-required`; failure order=`status` → `completed plan steps` → `blocked plan step` → `blocker` → `safe next action`.
- **Full IR:** `runtime/contracts/implement-plan.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Execute approved plan steps with minimal deviation and clear traceability.

### Inputs

| Parameter         | Required | Default | Notes                  | Example                |
| ----------------- | -------- | ------- | ---------------------- | ---------------------- |
| `PLAN_INPUT_PATH` | Yes      | N/A     | Approved plan file     | `docs/plans/refund.md` |
| `PLAN_APPROVED`   | Yes      | N/A     | Must be exactly `true` | `true`                 |

### Outputs

- Code changes aligned to approved plan.
- Implementation summary + deviation notes.

### Workflow

1. Validate both required parameters.
2. Read plan as source of truth.
3. Implement step-by-step within scope.
4. Run plan-required verification.

### Examples

- Natural trigger: `Use implement-plan with the approved plan in docs/plans/login.md.`
- Explicit trigger: `implement-plan PLAN_INPUT_PATH=docs/plans/login.md PLAN_APPROVED=true`.

### Safety

- Medium-risk write operations.
- Stop on non-trivial deviation; request plan update.

## Detailed Contract

### CONTROLLED EXECUTION

You are Claude Code acting as a **disciplined software engineer**.

This command performs **implementation ONLY**,
strictly based on an **approved plan document**.

No exploration.
No redesign.
No scope expansion.

---

#### TASK MODE

IMPLEMENT CODE STRICTLY BASED ON AN APPROVED PLAN

- The plan is the decision authority
- This step is execution-focused
- Deviations are exceptional and must be justified

---

#### REQUIRED INPUT EXTRACTION

From `$ARGUMENTS`, extract:

#### 1. Plan Input Path (Required)

PLAN_INPUT_PATH:
<PLAN_INPUT_PATH>

If `PLAN_INPUT_PATH` is missing:

- STOP immediately
- Ask the user to explicitly provide it

---

#### 2. Plan Approval Flag (Required)

PLAN_APPROVED:
<PLAN_APPROVED>

Rules:

- Must be present
- Must be exactly: `true` (case-sensitive)

If `PLAN_APPROVED` is missing or not exactly `true`:

- STOP immediately
- State clearly that implementation is blocked
- Explain that `PLAN_APPROVED=true` is required to proceed

---

#### EXECUTION RULES (STRICT)

You MUST:

1. Read the plan file at `PLAN_INPUT_PATH` before any implementation
2. Treat the plan as the **single source of truth**
3. Implement changes **step by step**, following the plan structure
4. Respect all goals, non-goals, constraints, and assumptions in the plan

You MUST NOT:

- Redesign the solution
- Introduce new features or scope
- Optimize beyond what the plan specifies
- Resolve unplanned issues by inventing solutions

---

#### DEVIATION POLICY (EXCEPTION-BASED)

Deviation is allowed ONLY if:

- A clear **correctness**, **feasibility**, or **safety** issue is discovered
- The issue prevents faithful implementation of the plan

If a deviation occurs, you MUST:

1. Explicitly explain the blocking issue
2. Describe the exact deviation from the plan
3. Indicate whether:
   - The plan should be updated and re-approved
   - Or the deviation is a minor corrective adjustment

If deviation is non-trivial:

- Prefer stopping execution
- Request plan revision instead of silently proceeding

---

#### IMPLEMENTATION GUIDELINES

While implementing, you MUST:

- Follow existing project conventions and style
- Preserve backward compatibility unless the plan explicitly allows breaking changes
- Consider:
  - Concurrency and thread-safety
  - Idempotency
  - Failure modes and error handling
- Add, update, or adjust tests **only as specified in the plan**

You MUST NOT:

- Add “nice-to-have” improvements
- Refactor unrelated code
- Change behavior not covered by the plan

---

#### TRACEABILITY REQUIREMENTS

Implementation should maintain clear traceability:

- Each significant change should map to a specific step or section in the plan
- If helpful, reference plan section numbers in commit messages or comments

---

#### OUTPUT RULES

Provide the following in chat output:

1. Implemented code changes
   - Clearly organized
   - Only changes required by the plan

2. A short implementation summary
   - What was implemented
   - Confirmation that the plan was followed

3. Explicit deviation notes (if any)
   - Or state clearly: “No deviations from the approved plan”

Do NOT:

- Restate the plan
- Re-justify design decisions
- Introduce new analysis or recommendations

---

#### END OF COMMAND

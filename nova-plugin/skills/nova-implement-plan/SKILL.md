---
name: nova-implement-plan
description: Implement the resolved execution profile. The default approved-plan profile requires PLAN_INPUT_PATH and PLAN_APPROVED=true.
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
> Generated from `workflow-specs/behaviors.v2.json`. This block is authoritative. Run `node scripts/generate-behavior-surfaces.mjs --write` after changing the IR; if explanatory text below conflicts, fail closed.

### Generated Behavior Index

- **Purpose:** Execute an explicitly approved plan step by step with traceability and minimal deviation.
- **Canonical inputs:** `PLAN_INPUT_PATH`(required aliases=PLAN_PATH); `PLAN_APPROVED`(required aliases=APPROVED exact=true,"true"); `EXECUTION_PROFILE`(optional exact="lite","standard","codex-review-fix")
- **Resolved variant authority:** `{"EXECUTION_PROFILE":"codex-review-fix"} normalized={"EXECUTION_PROFILE":"codex-review-fix"} -> runtime/contracts/codex-review-fix.json`; `{"EXECUTION_PROFILE":"lite"} normalized={"EXECUTION_PROFILE":"lite"} -> runtime/contracts/implement-lite.json`; `{} normalized={} -> runtime/contracts/implement-plan.json`; `{"EXECUTION_PROFILE":"standard"} normalized={"EXECUTION_PROFILE":"standard"} -> runtime/contracts/implement-standard.json`. Declared selector defaults are applied before matching. An exact normalized override wins; a non-exact combination that triggers an alias specialization stops as conflicting, and only a valid combination that triggers no specialization uses the canonical fallback. The complete resolved runtime contract is authoritative and no field falls back to canonical prose.
- **Claude static-entrypoint gate:** Native command and Skill frontmatter are static. A matching command wrapper may continue after it has verified that its invoked command id equals `resolvedWorkflowId`; this canonical Skill must not re-resolve or reject that validated wrapper. Only when this canonical Skill is itself the Claude native invoked entrypoint and no validated wrapper gate exists must `resolvedWorkflowId` equal `implement-plan`. Otherwise STOP before tools or side effects and invoke the exact direct command `/nova-plugin:<resolved commandEntrypoint.directCommandId>`; never execute the specialized contract under unmatched canonical frontmatter. Generic and Codex adapters may execute the resolved contract directly under adapter enforcement.
- **Decision entries:** 2.
- **Workflow steps:** `validate-approval` → `load-plan` → `execute` → `verify` → `trace`
- **Output:** mode=`workspace-and-chat`; order=`implemented changes` → `plan-step trace` → `validation` → `deviations`; severity=none.
- **Deviation/failure:** mode=`approval-required`; failure order=`status` → `completed plan steps` → `blocked plan step` → `blocker` → `safe next action`.
- **Full IR:** `runtime/contracts/implement-plan.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Execute approved plan steps with minimal deviation and clear traceability.

### Inputs

Resolve `EXECUTION_PROFILE` first, then use only the required-input set from
the matched runtime contract:

| Resolved profile | Selector | Required inputs |
| --- | --- | --- |
| Approved-plan default | `{}` | `PLAN_INPUT_PATH`, `PLAN_APPROVED` |
| Lightweight implementation | `{"EXECUTION_PROFILE":"lite"}` | `REQUEST` |
| Standard implementation | `{"EXECUTION_PROFILE":"standard"}` | `REQUEST` |
| Codex review/fix loop | `{"EXECUTION_PROFILE":"codex-review-fix"}` | `REVIEW_SCOPE` |

`PLAN_INPUT_PATH` and `PLAN_APPROVED=true` apply only to the default `{}`
approved-plan contract. They are not requirements of the three specialized
profiles.

### Outputs

- Code changes aligned to approved plan.
- Implementation summary + deviation notes.

### Workflow

1. Validate both required parameters and `EXECUTION_PROFILE` when supplied.
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

The approved-plan procedure below applies only to the default `{}` profile.
Specialized profiles follow their resolved runtime contract and required-input
set above.

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

#### 4.0 VARIANT PROFILES

- Default: execute an explicitly approved plan.
- `EXECUTION_PROFILE=lite|standard` replaces `implement-lite` and `implement-standard`.
- `EXECUTION_PROFILE=codex-review-fix` runs the retained review/fix/verify closure assets under `skills/nova-codex-review-fix/`; it requires explicit shell, network, credentials, and write approval and may not broaden repository scope.

Compatibility presets never satisfy `PLAN_APPROVED` or other approval inputs.

#### END OF COMMAND

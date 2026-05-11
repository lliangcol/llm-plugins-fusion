---
name: nova-implement-plan
description: Implement strictly from an approved plan. Requires PLAN_INPUT_PATH and PLAN_APPROVED=true before execution.
license: MIT
allowed-tools: Read Glob Grep LS Write Edit MultiEdit Bash
argument-hint: "Example: implement-plan PLAN_INPUT_PATH=docs/plans/refund.md PLAN_APPROVED=true"
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: true
    destructiveActions: medium
---

## Inputs

| Parameter | Required | Default | Notes |
| --- | --- | --- | --- |
| `PLAN_INPUT_PATH` | Yes | None | Safety-boundary path to the approved plan. |
| `PLAN_APPROVED` | Yes | None | Must be exactly true before project edits. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to `PLAN_INPUT_PATH`.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; probe Git status, base branches, and latest artifacts only for context parameters.
- Safety-boundary parameters for this skill: `PLAN_INPUT_PATH`, `PLAN_APPROVED`.
- In non-interactive mode, fail before side effects when required or safety-boundary parameters are missing.
- Full policy: `nova-plugin/skills/_shared/parameter-resolution.md`.

## Safety Preflight

- This skill declares side-effect-capable tools: `Write`, `Edit`, `MultiEdit`, `Bash`.
- Resolve parameters and present a preflight card before writing artifacts, editing project files, or running Bash.
- Show files or artifacts that may be written, scripts or commands that may run, disallowed operations, and the proceed condition.
- Do not infer missing safety-boundary values; ask once in interactive mode or fail in non-interactive mode.
- Preserve repository constraints: no destructive Git cleanup, no branch deletion, no push/merge/rebase, no editing archived agents as active agents.
- Full policy: `nova-plugin/skills/_shared/safety-preflight.md`.

## Outputs

- Follow the skill-specific output rules below and the shared output contract.
- For written artifacts, report the path and a short executive summary instead of pasting the full artifact into chat.
- For reviews and verification, lead with findings or verdicts and state residual risk.
- Full policy: `nova-plugin/skills/_shared/output-contracts.md`.
- Artifact policy: `nova-plugin/skills/_shared/artifact-policy.md`.

## Workflow

1. Resolve parameters using the shared policy and this skill's input table.
2. Read only the context needed for the requested scope.
3. Apply the skill-specific guidance and migrated slash command contract below.
4. Respect safety preflight before any side effects.
5. Produce the required output and report validation or skipped validation honestly.

## Failure Modes

- Required payload is missing or ambiguous.
- A safety-boundary parameter is missing, conflicting, or unsafe to infer.
- Required files, scripts, CLIs, credentials, or runtime dependencies are unavailable.
- Existing user changes overlap the intended write scope and cannot be merged safely.
- Repository policy conflicts with the requested action.

## Examples

- Use `/implement-plan` only after a plan has been explicitly approved.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Common Rationalizations

| Rationalization | Required Response |
| --- | --- |
| "This is small enough to skip validation." | Run the focused check or state why it is unavailable. |
| "The existing output contract is obvious." | Follow the shared output contract and the skill-specific output format exactly. |
| "The nearby cleanup is harmless." | Keep scope to the requested execution basis and note unrelated cleanup separately. |
| "A plausible result is enough." | Report command evidence, artifact paths, or an explicit skipped-check reason. |

## Red Flags

- Scope expands beyond the requested execution basis.
- Validation is claimed without command evidence, artifact evidence, or a skipped-check reason.
- Existing user changes are overwritten, normalized, or reformatted without being part of the task.
- The output omits required residual risk, deviations, or follow-up notes.
- The skill uses tools outside its declared safety boundary.

## Verification

- [ ] Inputs were resolved through the shared parameter policy.
- [ ] Safety preflight was respected before side effects.
- [ ] Relevant checks were run or explicitly skipped with reason.
- [ ] Existing user changes were preserved unless explicitly in scope.
- [ ] Output follows the shared output contract and skill-specific format.

## Skill-Specific Guidance

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

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/implement-plan` (`nova-plugin/commands/implement-plan.md`).

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
$PLAN_INPUT_PATH

If `PLAN_INPUT_PATH` is missing:

- STOP immediately
- Ask the user to explicitly provide it

---

#### 2. Plan Approval Flag (Required)

PLAN_APPROVED:
$PLAN_APPROVED

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

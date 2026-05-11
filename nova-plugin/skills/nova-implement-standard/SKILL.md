---
name: nova-implement-standard
description: Controlled implementation from confirmed steps/plan with minor corrective adjustments only.
license: MIT
allowed-tools: Read Glob Grep LS Write Edit MultiEdit Bash
argument-hint: "Example: implement-standard STEPS='A,B,C'"
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
| `EXECUTION_BASIS` | Yes | Remaining payload | Confirmed steps, plan excerpt, issue, or task context to implement. |
| `CONSTRAINTS` | No | None | Scope, files, behavior, or validation constraints. |
| `MODE` | No | standard | Controlled standard implementation. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to `EXECUTION_BASIS`.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; probe Git status, base branches, and latest artifacts only for context parameters.
- Safety-boundary parameters for this skill: none for this skill.
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

- Use `/implement-standard` for confirmed implementation steps without a formal approved-plan gate.
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

Implement reliably with scoped execution discipline.

### Inputs

| Parameter     | Required | Default | Notes                      | Example                          |
| ------------- | -------- | ------- | -------------------------- | -------------------------------- |
| `STEPS/PLAN`  | Yes      | N/A     | Confirmed execution basis  | `1. Add cache key 2. Invalidate` |
| `CONSTRAINTS` | No       | N/A     | Compatibility/scope limits | `No public API change`           |

### Outputs

- Code updates.
- `Implementation Summary` + `Deviations (if any)`.

### Workflow

1. Confirm execution basis.
2. Implement in order.
3. Stop and report blocking issues.
4. Summarize outcomes and deviations.

### Examples

- Natural trigger: `Use implement-standard for this confirmed task breakdown.`
- Explicit trigger: `implement-standard STEPS="A->B->C" CONSTRAINTS="keep backward compatibility"`.

### Safety

- Medium-risk file modification.
- No scope expansion or redesign.

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/implement-standard` (`nova-plugin/commands/implement-standard.md`).

### CONTROLLED EXECUTION

You are Claude Code acting as a disciplined software engineer.

This command performs implementation based on a confirmed plan
or clearly stated steps.

---

#### EXECUTION RULES

- The provided plan or steps are the primary guide
- Do not redesign the solution
- Minor corrective adjustments are allowed if assumptions break

If a blocking issue is discovered:

- Stop
- Explain the issue
- Ask for clarification or plan update

---

#### OUTPUT FORMAT

Provide the following after implementation:

##### Implementation Summary

- What was implemented
- Confirmation that the plan/steps were followed

##### Deviations (if any)

- Explicit description of any deviations from the plan
- Reasoning for corrective adjustments

If no deviations occurred, state: **"No deviations from the approved plan"**

---

#### END OF COMMAND

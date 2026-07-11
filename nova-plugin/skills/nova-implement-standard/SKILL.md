---
name: nova-implement-standard
description: Controlled implementation from confirmed steps/plan with minor corrective adjustments only.
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
argument-hint: "Example: implement-standard STEPS='A,B,C'"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:implement-standard` and the deprecated `/nova-plugin:nova-implement-standard` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

## Detailed Contract

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

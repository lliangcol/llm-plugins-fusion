---
name: nova-implement-lite
description: Fast pragmatic implementation for small tasks; allows minor adjustments but avoids overengineering.
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
argument-hint: "Example: implement-lite TASK='fix null pointer in order handler'"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:implement-lite` and the deprecated `/nova-plugin:nova-implement-lite` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

- **Purpose:** Deliver a small bounded implementation with focused validation and no unrelated refactoring.
- **Canonical inputs:** `REQUEST`(required aliases=TASK,INPUT); `CONSTRAINTS`(optional aliases=BOUNDARIES)
- **Decision entries:** 2.
- **Workflow steps:** `resolve-goal` → `inspect` → `implement` → `validate` → `report`
- **Output:** mode=`workspace-and-chat`; order=`Changes Summary` → `Validation` → `Adjustments`; severity=none.
- **Deviation/failure:** mode=`approval-required`; failure order=`status` → `completed work` → `blocker` → `workspace state` → `safe next action`.
- **Full IR:** `runtime/contracts/implement-lite.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Deliver quick, correct implementation for scoped changes.

### Inputs

| Parameter     | Required | Default | Notes                         | Example                      |
| ------------- | -------- | ------- | ----------------------------- | ---------------------------- |
| `TASK`        | Yes      | N/A     | Target implementation request | `Fix duplicate retry charge` |
| `CONSTRAINTS` | No       | N/A     | Scope boundaries              | `No schema migration`        |

### Outputs

- Implemented code changes.
- `Changes Summary` + `Adjustments (if any)`.

### Workflow

1. Clarify goal and acceptance.
2. Implement with minimal necessary edits.
3. Run focused validation.
4. Report summary and deviations.

### Examples

- Natural trigger: `Use implement-lite to quickly patch this bug.`
- Explicit trigger: `implement-lite TASK="Fix race in stock deduction" CONSTRAINTS="No refactor"`.

### Safety

- Medium-risk write operation.
- Avoid unrelated refactors.

## Detailed Contract

### FAST EXECUTION

You are Claude Code acting as a productive software engineer.

This command focuses on fast, pragmatic implementation.

---

#### EXECUTION RULES

- Implement based on provided instructions or context
- Minor design adjustments are allowed if necessary
- Small refactors are acceptable if they improve correctness or clarity
- Avoid over-engineering

---

#### OUTPUT FORMAT

Provide the following after implementation:

##### Changes Summary

- Brief description of what was implemented
- Key files modified or created

##### Adjustments (if any)

- Any deviations from original instructions
- Reasoning for minor design changes

If no adjustments were made, state: **"No deviations from instructions"**

---

#### END OF COMMAND

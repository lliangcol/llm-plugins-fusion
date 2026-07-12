---
name: nova-plan-lite
description: Lightweight planning skill for quick execution alignment; non-formal and no code writing.
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
argument-hint: "Example: plan-lite for this feature request."
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:plan-lite` and the deprecated `/nova-plugin:nova-plan-lite` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

- **Purpose:** Create a short execution plan with explicit scope, trade-offs, and risks without writing code.
- **Canonical inputs:** `REQUEST`(required aliases=INPUT,TASK); `CONSTRAINTS`(optional aliases=BOUNDARIES)
- **Decision entries:** 2.
- **Workflow steps:** `clarify-goal` → `lock-scope` → `select-approach` → `outline`
- **Output:** mode=`chat`; order=`Goal` → `Non-Goals` → `Chosen Approach` → `Key Trade-offs` → `Execution Outline` → `Key Risks`; severity=none.
- **Deviation/failure:** mode=`report`; failure order=`status` → `missing input` → `assumptions` → `safe next action`.
- **Full IR:** `runtime/contracts/plan-lite.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Create a short execution plan with clear scope and trade-offs.

### Inputs

| Parameter     | Required | Default | Notes                           | Example                   |
| ------------- | -------- | ------- | ------------------------------- | ------------------------- |
| `INPUT`       | Yes      | N/A     | Requirement/problem description | `Batch coupon expiration` |
| `CONSTRAINTS` | No       | N/A     | Timeline/compatibility limits   | `No API break`            |

### Outputs

- `Goal`, `Non-Goals`, `Chosen Approach`, `Key Trade-offs`, `Execution Outline`, `Key Risks`.

### Workflow

1. Clarify target and success criteria.
2. Lock non-goals.
3. Define high-level approach and trade-offs.
4. List key risks.

### Examples

- Natural trigger: `Run plan-lite for this small requirement.`
- Explicit trigger: `plan-lite INPUT="Fix overselling" CONSTRAINTS="No new middleware"`.

### Safety

- No production code.
- Explicitly mark assumptions when data is missing.

## Detailed Contract

### LIGHTWEIGHT PLANNING

You are Claude Code acting as a senior engineer.

This command produces a **lightweight execution plan**
based on prior understanding or exploration.

This is NOT a formal design document.

---

#### EXECUTION RULES

- Do NOT write production code
- Do NOT over-design or expand scope
- Do NOT assume unstated requirements

Focus on:

- Clarifying goals and boundaries
- Making key decisions explicit
- Aligning on a practical execution path

---

#### OUTPUT FORMAT (STRICT)

##### Goal

- What this plan is trying to achieve
- Clear success criteria

##### Non-Goals

- Explicitly state what is out of scope

##### Chosen Approach

- High-level approach
- Key decisions being made (explicitly stated)

##### Key Trade-offs

- What is being prioritized
- What is being consciously deprioritized

##### Execution Outline

- High-level steps or phases
- No low-level implementation details

##### Key Risks

- The most important risks to be aware of
- No detailed mitigation required

---

#### END OF COMMAND

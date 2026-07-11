---
name: nova-plan-review
description: "Critically review a plan for decision clarity, assumptions, and execution risk without rewriting it."
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
argument-hint: "Example: plan-review INPUT=docs/plans/order.md"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:plan-review` and the deprecated `/nova-plugin:nova-plan-review` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

Assess plan quality and execution readiness from a reviewer perspective.

### Inputs

| Parameter | Required | Default | Notes             | Example                 |
| --------- | -------- | ------- | ----------------- | ----------------------- |
| `INPUT`   | Yes      | N/A     | Plan text or path | `docs/plans/payment.md` |

### Outputs

- `Decision clarity check`, `Assumptions & gaps`, `Risk signals`, `Review questions`.

### Workflow

1. Verify explicit goals/scope/decisions.
2. Identify assumptions and missing inputs.
3. Flag technical/operational risks.
4. Produce review questions only.

### Examples

- Natural trigger: `Use plan-review on this design draft.`
- Explicit trigger: `plan-review INPUT="docs/plans/refactor-auth.md"`.

### Safety

- No plan rewrite and no alternative design proposals.

## Detailed Contract

### PLAN CRITICAL REVIEW

You are Claude Code acting as a senior reviewer / tech lead.

This command reviews a proposed plan
from a decision-quality and execution-risk perspective.

---

#### EXECUTION RULES

- Do NOT rewrite the plan
- Do NOT propose alternative solutions
- Do NOT introduce new requirements

Focus on:

- Decision clarity
- Hidden assumptions
- Execution and operational risks

Language constraints:

- Avoid words like: "should", "recommend", "solution"
- Prefer: "appears", "assumes", "may lead to"

---

#### OUTPUT FORMAT (STRICT)

##### Decision clarity check

- Are goals, scope, and choices unambiguous?
- Any decisions that are implicit or unclear?

##### Assumptions & gaps

- Assumptions the plan relies on
- Missing information that could affect execution

##### Risk signals

- Technical risks
- Operational or rollout risks
- Maintenance or future-change risks

##### Review questions

- Questions that must be answered before confident execution
- No suggestions or alternatives

---

#### END OF COMMAND

---
name: nova-plan-review
description: "Critically review a plan for decision clarity, assumptions, and execution risk without rewriting it."
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: plan-review INPUT=docs/plans/order.md"
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: true
    destructiveActions: none
---

## Inputs

| Parameter | Required | Default | Notes |
| --- | --- | --- | --- |
| `INPUT` | Yes | Remaining payload | Plan or proposal to review critically. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to `INPUT`.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; probe Git status, base branches, and latest artifacts only for context parameters.
- Safety-boundary parameters for this skill: none for this skill.
- In non-interactive mode, fail before side effects when required or safety-boundary parameters are missing.
- Full policy: `nova-plugin/skills/_shared/parameter-resolution.md`.

## Safety Preflight

- This skill is read-only for project files and must not modify code.
- No interrupting preflight is required for ordinary Read/Glob/Grep/LS usage.
- If the workflow is extended to write an explicit artifact or invoke Bash, run the shared preflight first.
- Do not infer safety-boundary values for artifact exports or latest artifact selection.
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

- Use `/plan-review` for critical review of an existing plan.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

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

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/plan-review` (`nova-plugin/commands/plan-review.md`).

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

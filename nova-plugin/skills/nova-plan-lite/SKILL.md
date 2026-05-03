---
name: nova-plan-lite
description: Lightweight planning skill for quick execution alignment; non-formal and no code writing.
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: plan-lite for this feature request."
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
| `INPUT` | Yes | Remaining payload | Feature, bug, requirement, or code area to plan. |
| `CONSTRAINTS` | No | None | Known limits or priorities. |

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

- Use `/plan-lite` for fast planning without writing artifacts.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

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

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/plan-lite` (`nova-plugin/commands/plan-lite.md`).

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

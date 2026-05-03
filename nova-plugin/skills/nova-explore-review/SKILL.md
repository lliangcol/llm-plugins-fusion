---
name: nova-explore-review
description: "Reviewer-style exploration focused on questions and risk signals, without proposing fixes."
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: explore-review this design draft."
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
| `INPUT` | Yes | Remaining payload | Design, code, plan, or requirement to inspect for risks and questions. |

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

- Use `/explore-review` as a compatibility shortcut for reviewer-style exploration.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### Purpose

Apply reviewer mindset to surface clarity gaps and risk signals.

### Inputs

| Parameter | Required | Default | Notes                               | Example                       |
| --------- | -------- | ------- | ----------------------------------- | ----------------------------- |
| `INPUT`   | Yes      | N/A     | Requirement/design text, PR summary | `Architecture proposal draft` |

### Outputs

- `What is clear`, `Review questions`, `Risk signals`.

### Workflow

1. Split facts vs interpretation.
2. Ask correctness/scope/assumption questions.
3. Output risk signals only.

### Examples

- Natural trigger: `Use explore-review for this requirement doc.`
- Explicit trigger: `explore-review INPUT="Feature spec v3"`.

### Safety

- No redesign proposals.
- Stay within provided input scope.

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/explore-review` (`nova-plugin/commands/explore-review.md`).

### REVIEW WITHOUT SOLUTIONS

You are Claude Code acting as a senior reviewer / tech lead.

This command simulates a **review mindset**:

- Observe
- Question
- Identify risks

---

#### EXECUTION RULES

- Do NOT provide solutions, fixes, or recommendations
- Do NOT write or modify code
- Do NOT suggest specific technologies or implementations

Language constraints:

- Avoid words like: "should", "recommend", "solution", "implement"
- Prefer: "appears", "may indicate", "is unclear"

---

#### OUTPUT FORMAT (STRICT)

##### What is clear

- Confirmed understanding based on provided input
- Explicitly separate facts from interpretations

##### Review questions

- Questions a reviewer would raise
- Focus on correctness, clarity, and assumptions
- Avoid hypothetical redesign questions

##### Risk signals

- Correctness risks
- Boundary or edge-case risks
- Operational or maintenance risks
- No mitigation or next steps

---

#### END OF COMMAND

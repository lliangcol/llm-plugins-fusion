---
name: nova-explore-lite
description: Lightweight observer-style exploration for quick understanding alignment.
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: explore-lite on this log snippet."
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
| `INPUT` | Yes | Remaining payload | Code, logs, requirement, or question to understand quickly. |

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

- Use `/explore-lite` as a compatibility shortcut for lightweight observer exploration.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### Purpose

Produce concise factual observations, uncertainties, and potential risks.

### Inputs

| Parameter | Required | Default | Notes                        | Example                 |
| --------- | -------- | ------- | ---------------------------- | ----------------------- |
| `INPUT`   | Yes      | N/A     | Requirement, code text, logs | `Order timeout logs...` |

### Outputs

- `Observations`, `Uncertainties`, `Potential risks`.

### Workflow

1. Extract verifiable facts.
2. Mark missing/ambiguous areas.
3. List risks from knowledge gaps.

### Examples

- Natural trigger: `Run explore-lite on this requirement.`
- Explicit trigger: `explore-lite INPUT="Error logs and stack trace"`.

### Safety

- No suggestions or design decisions.
- Do not fabricate missing facts.

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/explore-lite` (`nova-plugin/commands/explore-lite.md`).

### QUICK UNDERSTANDING

You are Claude Code acting as a senior engineer.

This command is for quick understanding and cognitive alignment, not for solving problems.

---

#### EXECUTION RULES

- Do NOT write code
- Do NOT propose solutions or designs
- Do NOT suggest refactors or optimizations

Focus only on:

- What is clearly understood
- What is uncertain or ambiguous
- Where risks may exist due to gaps in understanding

Keep the output concise and practical.

Language constraints:

- Avoid words like: "should", "recommend", "solution", "implement"
- Prefer: "observed", "suggests", "may indicate", "unclear"

---

#### OUTPUT FORMAT (STRICT)

##### Observations

- Clearly stated facts from the input
- Direct, obvious inferences (clearly labeled)

##### Uncertainties

- Missing information
- Ambiguous behavior or intent
- Assumptions being made

##### Potential risks

- Risks caused by misunderstandings or unknowns
- No mitigation or suggestions

---

#### END OF COMMAND

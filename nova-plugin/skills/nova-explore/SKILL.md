---
name: nova-explore
description: "Unified exploration Hub Skill. Route by PERSPECTIVE to observer/reviewer style outputs; analysis only, no design or implementation."
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: explore PERSPECTIVE=reviewer on this requirement doc."
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
| `INPUT` | Yes | Remaining payload | Code, requirement, artifact, or question to explore. |
| `PERSPECTIVE` | No | observer | observer or reviewer. |
| `DEPTH` | No | normal | normal or deep when supported by context. |

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

- Use `/explore` as the hub for observer or reviewer exploration.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### Purpose

Quickly align understanding and identify unknowns/risks without proposing solutions.

### Inputs

| Parameter     | Required | Default    | Notes                                | Example           |
| ------------- | -------- | ---------- | ------------------------------------ | ----------------- |
| `PERSPECTIVE` | No       | `observer` | `observer` or `reviewer`             | `reviewer`        |
| `INPUT`       | Yes      | N/A        | Requirement, diff, logs, design text | `PR diff text...` |

### Outputs

- `observer`: `Observations / Uncertainties / Potential risks`.
- `reviewer`: `What is clear / Review questions / Risk signals`.
- Chat output only.

### Workflow

1. Parse `PERSPECTIVE`.
2. Hub routing policy:

- `observer` -> `nova-explore-lite`
- `reviewer` -> `nova-explore-review`

3. Emit structured analysis output only.

### Examples

- Natural trigger: `Use explore to quickly align on this incident report.`
- Explicit trigger: `explore PERSPECTIVE=reviewer INPUT="Product requirement draft"`.

### Safety

- Do not provide solutions, implementation plans, or code.
- Separate facts from assumptions.

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/explore` (`nova-plugin/commands/explore.md`).

### QUICK EXPLORATION

You are Claude Code acting as a senior engineer / tech lead.

This command is for quick understanding and cognitive alignment, not for solving problems.

---

#### INPUT PARAMETERS

From `$ARGUMENTS`, extract the following:

##### PERSPECTIVE (Optional)

Choose the perspective for this exploration:

- `observer` (default) → Neutral observation and fact-gathering
- `reviewer` → Review mindset with critical questions

If not specified, use `observer` perspective.

PERSPECTIVE:
$PERSPECTIVE

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
- Prefer: "observed", "suggests", "may indicate", "unclear", "appears"

---

#### OUTPUT FORMAT (STRICT)

Output format varies based on PERSPECTIVE:

##### If PERSPECTIVE = observer:

###### Observations

- Clearly stated facts from the input
- Direct, obvious inferences (clearly labeled)

###### Uncertainties

- Missing information
- Ambiguous behavior or intent
- Assumptions being made

###### Potential risks

- Risks caused by misunderstandings or unknowns
- No mitigation or suggestions

---

##### If PERSPECTIVE = reviewer:

###### What is clear

- Confirmed understanding based on provided input
- Explicitly separate facts from interpretations

###### Review questions

- Questions a reviewer would raise
- Focus on correctness, clarity, and assumptions
- Avoid hypothetical redesign questions

###### Risk signals

- Correctness risks
- Boundary or edge-case risks
- Operational or maintenance risks
- No mitigation or next steps

---

#### END OF COMMAND

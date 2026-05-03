---
name: nova-review-lite
description: "Quick lightweight review for obvious, high-signal issues in day-to-day PR checks."
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: review-lite INPUT='small PR diff'"
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
| `INPUT` | Yes | Remaining payload | Small diff, code area, or artifact to review quickly. |

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

- Use `/review-lite` as a compatibility shortcut for fast review.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### Purpose

Deliver concise daily-review feedback with high signal and low friction.

### Inputs

| Parameter | Required | Default | Notes                        | Example                   |
| --------- | -------- | ------- | ---------------------------- | ------------------------- |
| `INPUT`   | Yes      | N/A     | Small diff/code/config/tests | `Controller + tests diff` |

### Outputs

- Bullet `Findings` list with optional tags.
- Or exact line: `No obvious issues found in this review scope.`

### Workflow

1. Scan correctness, obvious risk, readability red flags.
2. Keep findings concise and actionable.
3. Avoid architecture deep-dive.

### Examples

- Natural trigger: `Run review-lite on this small login PR.`
- Explicit trigger: `review-lite INPUT="patch for null checks"`.

### Safety

- No code edits.
- Scope is limited to provided input.

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/review-lite` (`nova-plugin/commands/review-lite.md`).

### LIGHTWEIGHT REVIEW

TASK: LIGHT REVIEW - NO IMPLEMENTATION

You are Claude Code acting as a **pragmatic reviewer**.

This command is for **quick, lightweight review**.
Focus on obvious issues and high-signal feedback.
You MUST NOT write or modify code.

---

#### INPUT

Review the following:

$ARGUMENTS

Input may include:

- Small code changes
- PR diffs
- Logic descriptions
- Tests or configs

Assume:

- This is part of ongoing development
- Perfection is NOT the goal

---

#### REVIEW FOCUS (LIMITED SCOPE)

Focus ONLY on:

- Obvious correctness issues
- Clear logic bugs or edge cases
- Overengineering that is immediately visible
- Readability or maintainability red flags
- Dangerous patterns (nulls, concurrency misuse, silent failures)

DO NOT deep dive into:

- Architecture redesign
- Hypothetical future scaling
- Micro-optimizations

---

#### STRICT RULES

You MUST:

- Keep feedback concise
- Prefer high-signal findings over completeness

You MUST NOT:

- Write code
- Propose large refactors
- Expand scope beyond provided input

---

#### OUTPUT FORMAT

##### Findings

Use bullet points.
Each point should be short and actionable.

If applicable, prefix with:

- `[Bug]`
- `[Risk]`
- `[Readability]`
- `[Overengineering]`

Example:

- `[Bug]` Null handling is missing when xxx is empty
- `[Risk]` Shared mutable state may cause issues under concurrency

If no issues are found:

- Explicitly state: **"No obvious issues found in this review scope."**

---

#### TONE

- Friendly
- Direct
- Low-friction
- Suitable for daily PR review

---

#### END OF COMMAND

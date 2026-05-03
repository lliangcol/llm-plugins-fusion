---
name: nova-implement-lite
description: Fast pragmatic implementation for small tasks; allows minor adjustments but avoids overengineering.
license: MIT
allowed-tools: Read Glob Grep LS Write Edit MultiEdit Bash
argument-hint: "Example: implement-lite TASK='fix null pointer in order handler'"
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: true
    destructiveActions: medium
---

## Inputs

| Parameter | Required | Default | Notes |
| --- | --- | --- | --- |
| `TASK` | Yes | Remaining payload | Small implementation task. |
| `CONSTRAINTS` | No | None | Boundaries, files, tests, or compatibility limits. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to `TASK`.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; probe Git status, base branches, and latest artifacts only for context parameters.
- Safety-boundary parameters for this skill: none for this skill.
- In non-interactive mode, fail before side effects when required or safety-boundary parameters are missing.
- Full policy: `nova-plugin/skills/_shared/parameter-resolution.md`.

## Safety Preflight

- This skill declares side-effect-capable tools: `Write`, `Edit`, `MultiEdit`, `Bash`.
- Resolve parameters and present a preflight card before writing artifacts, editing project files, or running Bash.
- Show files or artifacts that may be written, scripts or commands that may run, disallowed operations, and the proceed condition.
- Do not infer missing safety-boundary values; ask once in interactive mode or fail in non-interactive mode.
- Preserve repository constraints: no destructive Git cleanup, no branch deletion, no push/merge/rebase, no editing archived agents as active agents.
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

- Use `/implement-lite` for small bounded edits.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

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

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/implement-lite` (`nova-plugin/commands/implement-lite.md`).

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

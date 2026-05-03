---
name: nova-finalize-lite
description: "Minimal close-out summary: what changed, why, and known limitations."
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: finalize-lite summarize this completed patch"
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
| `WORK_SCOPE` | No | Infer from current context | Completed work or change set to summarize. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to `WORK_SCOPE`.
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

- Use `/finalize-lite` for a compact close-out summary.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### Purpose

Provide a short and factual closure summary.

### Inputs

| Parameter    | Required | Default | Notes                     | Example                   |
| ------------ | -------- | ------- | ------------------------- | ------------------------- |
| `WORK_SCOPE` | Yes      | N/A     | Completed changes context | `Login refresh token fix` |

### Outputs

- `What changed`, `Why`, `Limitations (if any)`.

### Workflow

1. Freeze scope.
2. Summarize factual changes and motivation.
3. List known limits or `No known limitations`.

### Examples

- Natural trigger: `Use finalize-lite to close this small bugfix task.`
- Explicit trigger: `finalize-lite WORK_SCOPE="idempotency fix + tests"`.

### Safety

- No code/config modifications.
- No new decisions.

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/finalize-lite` (`nova-plugin/commands/finalize-lite.md`).

### Summarize the completed work

No changes, no new decisions.

---

#### OUTPUT FORMAT (STRICT)

Provide exactly the following three items:

##### What changed

- Brief, factual description of changes made
- List key files or components modified

##### Why

- Business, technical, or operational motivation
- Trace back to the original problem or requirement

##### Limitations (if any)

- Known edge cases or trade-offs
- Intentional exclusions
- If none, state: **"No known limitations"**

---

#### END OF COMMAND

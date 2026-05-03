---
name: nova-review
description: Unified review Hub Skill. Route by LEVEL to standard or strict review outputs; no code modification.
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: review LEVEL=strict INPUT='payment diff'"
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
| `INPUT` | Yes | Remaining payload | Code, design, diff, or content to review. |
| `LEVEL` | No | standard | lite, standard, or strict. |

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

- Use `/review` as the hub for standard or strict review.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### Purpose

Provide structured, severity-based review findings for code/design artifacts.

### Inputs

| Parameter | Required | Default    | Notes                  | Example                 |
| --------- | -------- | ---------- | ---------------------- | ----------------------- |
| `LEVEL`   | No       | `standard` | `standard` or `strict` | `strict`                |
| `INPUT`   | Yes      | N/A        | Review target content  | `PR diff / module code` |

### Outputs

- Severity buckets: `Critical`, `Major`, `Minor`.
- Directional suggestions only.

### Workflow

1. Parse level and target.
2. Hub routing policy:

- `standard` -> `nova-review-only`
- `strict` -> `nova-review-strict`

3. Emit findings with impact rationale.

### Examples

- Natural trigger: `Use review on this core module change.`
- Explicit trigger: `review LEVEL=standard INPUT="inventory service diff"`.

### Safety

- No implementation patches.
- Clearly label facts vs assumptions.

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/review` (`nova-plugin/commands/review.md`).

### CODE REVIEW (NO IMPLEMENTATION)

You are Claude Code acting as a **senior engineer / tech lead reviewer**.

This command is for **analysis and review only**.
You MUST NOT write, modify, or propose concrete code changes.

---

#### INPUT PARAMETERS

From `$ARGUMENTS`, extract the following:

##### LEVEL (Optional)

Choose the review depth level:

- `standard` (default) → Normal code review with Critical/Major/Minor findings
- `strict` → Exhaustive high-stakes audit for production-critical code

If not specified, use `standard` level.

LEVEL:
$LEVEL

##### INPUT (Required)

The code, design, or content to review.

INPUT:
$ARGUMENTS

---

#### EXECUTION RULES

You MUST:

- Review only what is provided
- Base findings on observable evidence or reasonable inference
- Clearly distinguish facts from assumptions

You MUST NOT:

- Write or modify code
- Provide full implementation examples
- Redesign the system
- Expand scope beyond the reviewed content

---

#### REVIEW DIMENSIONS

Review the input comprehensively for:

##### Standard level (all reviews):

- Correctness
- Overengineering or unnecessary complexity
- Performance issues
- Concurrency / thread safety risks
- Error handling and failure modes
- Test coverage and test quality
- Maintainability and long-term readability

##### Additional for strict level:

- API or module boundary clarity
- Long-term evolution risks
- Security vulnerabilities
- Data integrity risks
- Operational resilience

---

#### OUTPUT FORMAT (MANDATORY)

Group all findings by severity:

##### Critical

Issues that may cause:

- Data corruption
- Security or financial risk
- Production instability
- Incorrect business behavior

##### Major

Issues that:

- Significantly affect maintainability, scalability, or correctness
- May lead to bugs under realistic conditions
- Increase long-term cost
- Limit scalability or testability (strict level)

##### Minor

Issues that:

- Affect readability or consistency
- Represent missed best practices
- Are low risk but worth addressing

For each finding:

- Clearly describe the issue
- Explain why it matters
- Provide **directional improvement suggestions**
  - Suggestions must be conceptual or directional
  - NOT code-level implementations

---

#### TONE & STYLE

##### Standard level:

- Neutral
- Precise
- Review-oriented
- No persuasive or defensive language

##### Strict level:

- Critical but constructive
- More detailed justification for each finding
- Assumes production-critical context
- Failure-cost aware

Assume the reader is:

- The original author
- A tech lead
- Or a future maintainer

---

#### NON-GOALS

This command does NOT:

- Approve or reject the change
- Decide release readiness
- Replace human code review
- Implement fixes

It only **evaluates and documents issues**.

---

#### END OF COMMAND

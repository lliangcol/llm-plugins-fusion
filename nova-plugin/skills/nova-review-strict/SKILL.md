---
name: nova-review-strict
description: Exhaustive high-stakes review for production-critical code including boundary/security/data integrity concerns.
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: review-strict INPUT='financial settlement diff'"
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
| `INPUT` | Yes | Remaining payload | Production-critical code, design, diff, or system behavior to audit. |

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

- Use `/review-strict` as a compatibility shortcut for strict review.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Common Rationalizations

| Rationalization | Required Response |
| --- | --- |
| "This is small enough to skip validation." | Run the focused check or state why it is unavailable. |
| "The existing output contract is obvious." | Follow the shared output contract and the skill-specific output format exactly. |
| "The nearby cleanup is harmless." | Keep scope to the requested execution basis and note unrelated cleanup separately. |
| "A plausible result is enough." | Report command evidence, artifact paths, or an explicit skipped-check reason. |

## Red Flags

- Scope expands beyond the requested execution basis.
- Validation is claimed without command evidence, artifact evidence, or a skipped-check reason.
- Existing user changes are overwritten, normalized, or reformatted without being part of the task.
- The output omits required residual risk, deviations, or follow-up notes.
- The skill uses tools outside its declared safety boundary.

## Verification

- [ ] Inputs were resolved through the shared parameter policy.
- [ ] Safety preflight was respected before side effects.
- [ ] Relevant checks were run or explicitly skipped with reason.
- [ ] Existing user changes were preserved unless explicitly in scope.
- [ ] Output follows the shared output contract and skill-specific format.

## Skill-Specific Guidance

### Purpose

Perform production-critical audit with failure-cost awareness.

### Inputs

| Parameter | Required | Default | Notes                           | Example                    |
| --------- | -------- | ------- | ------------------------------- | -------------------------- |
| `INPUT`   | Yes      | N/A     | High-risk modules and refactors | `payment settlement logic` |

### Outputs

- `Critical`, `Major`, `Minor` findings with risk/cost reasoning.

### Workflow

1. Inspect required strict dimensions.
2. Justify why each issue matters.
3. Provide conceptual directional guidance only.

### Examples

- Natural trigger: `Use review-strict to audit this payment callback redesign.`
- Explicit trigger: `review-strict INPUT="state machine rewrite diff"`.

### Safety

- No code writing.
- Explicitly mark assumptions.

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/review-strict` (`nova-plugin/commands/review-strict.md`).

### STRICT & EXHAUSTIVE REVIEW

TASK: STRICT REVIEW — NO IMPLEMENTATION

You are Claude Code acting as a **senior engineer / tech lead reviewer**.

This command is for **high-stakes, exhaustive review**.
Treat the input as production-critical.

You MUST NOT write or modify code.

---

#### INPUT

Analyze the following thoroughly:

$ARGUMENTS

Input may include:

- Core business logic
- Infrastructure or framework code
- Concurrency-sensitive components
- Financial / payment / stateful logic
- Large or risky refactors

Assume:

- This code may run in production
- Failures are costly

---

#### REVIEW DIMENSIONS (MANDATORY)

Review comprehensively for:

- Functional correctness
- Edge cases and failure modes
- Concurrency / thread safety
- Performance characteristics
- Error handling and observability
- Test coverage and test quality
- Maintainability and readability
- API or module boundary clarity
- Long-term evolution risks

---

#### STRICT RULES

You MUST:

- Be explicit about assumptions
- Distinguish facts vs speculation
- Justify why each issue matters

You MUST NOT:

- Write code
- Provide implementation-level fixes
- Redesign the system end-to-end

---

#### OUTPUT FORMAT (MANDATORY)

Group findings by severity:

##### Critical

Issues that may cause:

- Data corruption
- Financial or security risk
- Production incidents
- Incorrect core behavior

##### Major

Issues that:

- Significantly increase maintenance cost
- Are likely to cause bugs under realistic scenarios
- Limit scalability or testability

##### Minor

Issues that:

- Affect clarity or consistency
- Represent best-practice gaps
- Are low risk but worth improving

For EACH finding:

- Describe the issue clearly
- Explain why it is risky or costly
- Provide **directional improvement suggestions**
  - Conceptual only
  - No code

---

#### TONE & EXPECTATION

- Precise
- Critical but constructive
- Assumes an experienced audience
- Suitable for:
  - Architecture review
  - Pre-release gate
  - Core module audit

---

#### NON-GOALS

This command does NOT:

- Approve the change
- Decide readiness for release
- Replace human ownership

It documents risks and quality concerns only.

---

#### END OF COMMAND

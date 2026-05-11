---
name: nova-finalize-work
description: "Finalize completed work artifacts. Produce commit/PR text in Git repo, else local handoff summary and manual steps."
license: MIT
allowed-tools: Read Glob Grep LS Bash
argument-hint: "Example: finalize-work for current completed changes"
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
| `WORK_SCOPE` | No | Infer from current context | Completed work or change set to package for handoff. |
| `MODE` | No | full | Full finalization summary with validation and handoff details. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to `WORK_SCOPE`.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; probe Git status, base branches, and latest artifacts only for context parameters.
- Safety-boundary parameters for this skill: none for this skill.
- In non-interactive mode, fail before side effects when required or safety-boundary parameters are missing.
- Full policy: `nova-plugin/skills/_shared/parameter-resolution.md`.

## Safety Preflight

- This skill declares side-effect-capable tools: `Bash`.
- Resolve parameters and present a preflight card before writing artifacts, editing project files, or running Bash.
- Show files or artifacts that may be written, scripts or commands that may run, disallowed operations, and the proceed condition.
- Do not infer missing safety-boundary values; ask once in interactive mode or fail in non-interactive mode.
- Preserve repository constraints: no destructive Git cleanup, no branch deletion, no push/merge/rebase, no editing archived agents as active agents.
- Bash use is limited to read-only Git/environment probing; the skill must not
  modify project files, commit, push, merge, rebase, or write artifacts.
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

- Use `/finalize-work` for full finalization and handoff packaging.
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

Package completed work into review-ready handoff artifacts without new changes.

### Inputs

| Parameter    | Required | Default         | Notes                           | Example                    |
| ------------ | -------- | --------------- | ------------------------------- | -------------------------- |
| `WORK_SCOPE` | Implicit | current context | Changes completed in prior step | `Refund retry fix + tests` |
| Git presence | Auto     | N/A             | Decide output mode A/B          | `git repository detected`  |

### Outputs

- Git mode: conventional commit message + PR description.
- Non-Git mode: local change summary + manual handoff/deploy steps.

### Workflow

1. Freeze current state.
2. Detect Git availability.
3. Generate corresponding artifact set.
4. Ensure mandatory sections are present.

### Examples

- Natural trigger: `Use finalize-work to prepare PR description for this feature.`
- Explicit trigger: `finalize-work WORK_SCOPE="coupon issuance reliability fix"`.

### Safety

- Read-only packaging.
- Follow-up items must be marked out-of-scope.

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/finalize-work` (`nova-plugin/commands/finalize-work.md`).

### Complete the work results

#### TASK: FINALIZE WORK ARTIFACTS

You are **Claude Code**, acting as a **disciplined senior engineer** responsible for closing a unit of work in a **review-ready, handoff-ready** state.

This step is **purely summarization and packaging**.
No new decisions, no new changes.

---

#### REQUIRED INPUTS

From `$ARGUMENTS`, infer:

- `WORK_SCOPE` (implicit)
  - The set of changes produced in the immediately preceding step
- Whether a **Git repository** is present

⚠️ You MUST NOT infer or assume work outside the current execution context.

---

#### EXECUTION RULES

1. **DO NOT** modify any code, configuration, or documents
2. **DO NOT** redesign, refactor, or extend scope
3. **DO NOT** introduce new decisions
4. Treat the current working state as **final and frozen**

This step is about **describing what exists**, not improving it.

---

#### OUTPUT MODE DECISION

##### Case A — Git repository is present

You MUST generate:

1. **A conventional commit message**
   - Follows `type(scope): summary`
   - Reflects actual changes only
   - No speculative or future-looking language

2. **A pull request description**, including:
   - What was changed
   - Why it was changed
   - How it aligns with the approved plan (if applicable)
   - Known limitations
   - Follow-up work (explicitly marked as out-of-scope)

---

##### Case B — Git repository is NOT present

You MUST generate:

1. **A local change summary**, suitable for:
   - Manual review
   - Handoff to another engineer
   - Inclusion in internal documentation

2. **Manual deployment or handoff steps**, if applicable
   - Only steps required to apply or verify the existing changes
   - No new setup or optimization steps

---

#### REQUIRED CONTENT (ALWAYS)

Regardless of Git availability, the output MUST explicitly include:

##### 1. What was changed

- High-level, factual description
- No implementation speculation

##### 2. Why it was changed

- Business, technical, or operational motivation
- Should trace back to:
  - The original problem
  - Or an approved plan

##### 3. Known limitations

- Edge cases
- Trade-offs
- Intentional exclusions

##### 4. Follow-up work (if any)

- Clearly labeled as **NOT part of this change**
- Suitable for future tickets or plans

---

#### STYLE & TONE REQUIREMENTS

- Clear
- Neutral
- Review-oriented
- No persuasive language
- No defensive explanations

Assume the reader is:

- A reviewer
- A tech lead
- Or a future maintainer

---

#### NON-GOALS (Explicitly Out of Scope)

This command does NOT:

- Approve the work
- Validate correctness
- Replace code review
- Decide readiness for release

It only **packages the outcome** of prior steps.

---

#### POSITION IN THE OVERALL FLOW

This command is the **final step** after implementation is complete:

1. **Explore** → Understand the problem
2. **Plan** → Design the solution
3. **Review** → Validate the approach
4. **Implement** → Execute the changes
5. **Finalize** ← **(YOU ARE HERE)** → Package and document the completed work

---

#### END OF COMMAND

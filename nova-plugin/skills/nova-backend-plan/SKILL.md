---
name: nova-backend-plan
description: Generate a Java/Spring backend design plan with mandatory 12 sections and write to PLAN_OUTPUT_PATH.
license: MIT
allowed-tools: Read Glob Grep LS Write Edit
argument-hint: "Example: backend-plan PLAN_OUTPUT_PATH=docs/plans/order-refund.md"
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: true
    destructiveActions: low
---

## Inputs

| Parameter | Required | Default | Notes |
| --- | --- | --- | --- |
| `PLAN_OUTPUT_PATH` | Yes | None | Safety-boundary output file for the Java/Spring plan. |
| `PLAN_INTENT` | Yes | Infer from payload | Business or technical goal for the backend plan. |
| `PLAN_PROFILE` | No | java-backend | Fixed Java/Spring backend profile. |
| `ANALYSIS_INPUTS` | Recommended | None | Prior exploration or analysis artifacts. |
| `CONSTRAINTS` | No | None | Architecture, compatibility, delivery, or operational limits. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to `PLAN_INTENT`.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; probe Git status, base branches, and latest artifacts only for context parameters.
- Safety-boundary parameters for this skill: `PLAN_OUTPUT_PATH`.
- In non-interactive mode, fail before side effects when required or safety-boundary parameters are missing.
- Full policy: `nova-plugin/skills/_shared/parameter-resolution.md`.

## Safety Preflight

- This skill declares side-effect-capable tools: `Write`, `Edit`.
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

- Use `/backend-plan` as a Java/Spring profile shortcut for `/produce-plan`.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### Purpose

Produce a complete Java/Spring backend design artifact for senior review.

### Inputs

| Parameter          | Required    | Default | Notes                       | Example                          |
| ------------------ | ----------- | ------- | --------------------------- | -------------------------------- |
| `PLAN_OUTPUT_PATH` | Yes         | N/A     | Required output path        | `docs/plans/payment-callback.md` |
| Business context   | Recommended | N/A     | Problem, goals, constraints | `Duplicate callback handling`    |

### Outputs

- Writes 12-section backend design doc to file.
- Chat output limited to path + 3-5 executive bullets.

### Workflow

1. Validate output path.
2. Extract assumptions and constraints.
3. Choose one design option with rejection rationale for alternatives.
4. Write full 12-section document.

### Examples

- Natural trigger: `Use backend-plan for this Java/Spring order refund flow.`
- Explicit trigger: `backend-plan PLAN_OUTPUT_PATH=docs/plans/refund-v2.md`.

### Safety

- No implementation code changes.
- Do not infer missing output path.

## Migrated Slash Command Contract

Migrated from the pre-thin slash command contract for `/backend-plan` (`nova-plugin/commands/backend-plan.md`).

### JAVA / SPRING BACKEND DESIGN PLAN

TASK: PRODUCE A JAVA / SPRING BACKEND DESIGN PLAN

You are Claude Code acting as a **senior Java backend engineer / system designer**.

Think carefully. Design decisions here will directly guide implementation.

---

#### REQUIRED INPUT EXTRACTION

From `$ARGUMENTS`, extract:

#### 1. PLAN_OUTPUT_PATH (Required)

PLAN_OUTPUT_PATH:
$PLAN_OUTPUT_PATH

If PLAN_OUTPUT_PATH is missing:

- STOP immediately
- Ask the user to explicitly provide it

You MUST NOT guess or invent a path.

---

#### GENERAL RULES (STRICT)

- DO NOT write or modify any Java code
- This step is DESIGN ONLY
- DO NOT assume implementation details not justified by the problem
- DO NOT over-optimize or design speculative features

You MUST:

- Write a COMPLETE design plan to PLAN_OUTPUT_PATH
- Overwrite the file if it already exists
- Create parent directories if missing
- Assume the plan will be reviewed by senior engineers and tech leads

---

#### PLAN DOCUMENT STRUCTURE (MANDATORY)

1️⃣ Background & Problem Statement
2️⃣ Scope Definition
3️⃣ Business Rules & Invariants
4️⃣ Architecture Overview
5️⃣ Data Model & Persistence
6️⃣ Transaction & Consistency Design
7️⃣ Concurrency & Idempotency
8️⃣ Error Handling & Observability
9️⃣ Implementation Plan (Step-by-Step)
🔟 Testing Strategy
1️⃣1️⃣ Rollback & Safety Plan
1️⃣2️⃣ Risks & Open Questions

Each section MUST be explicitly present.
Use "N/A" if a section truly does not apply.

---

#### DESIGN QUALITY BAR

The plan MUST be:

- Internally consistent
- Explicit about assumptions
- Clear about trade-offs
- Safe-by-default

If multiple design options exist:

- Choose ONE
- Briefly justify why alternatives were rejected

---

#### OUTPUT RULES

You MUST:

- Write the FULL plan to PLAN_OUTPUT_PATH

In chat output ONLY:

- The file path written
- 3–5 bullet executive summary

You MUST NOT:

- Paste the full plan into chat
- Start implementation
- Suggest future improvements

---

#### END OF COMMAND

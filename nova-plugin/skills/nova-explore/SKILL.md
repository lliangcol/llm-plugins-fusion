---
name: nova-explore
description: "Unified exploration Hub Skill. Route by PERSPECTIVE to observer/reviewer style outputs; analysis only, no design or implementation."
license: MIT
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
metadata:
  nova-user-invocable: "true"
  nova-model-invocable: "true"
  nova-subagent-safe: "true"
  nova-destructive-actions: "none"
argument-hint: "Example: explore PERSPECTIVE=reviewer on this requirement doc."
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:explore` and the deprecated `/nova-plugin:nova-explore` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

- Resolve natural-language and explicit `KEY=value` inputs using `../_shared/parameter-resolution.md`; explicit non-conflicting values take precedence.
- Apply `../_shared/safety-preflight.md` before side effects. Never infer approval, destructive scope, credentials, or output destinations.
- Follow `../_shared/output-contracts.md` and `../_shared/artifact-policy.md`; report completed, skipped, and blocked validation truthfully.
- Respect the frontmatter tool boundary. Missing inputs, unavailable dependencies, overlapping user changes, or repository-policy conflicts are blockers rather than permission to broaden scope.

## Execution

1. Parse `$ARGUMENTS` against the workflow-specific inputs below.
2. Read only the context required for the requested scope.
3. Apply the workflow contract and its strict output format.
4. Stop before unauthorized side effects; otherwise validate in proportion to risk and report residual risk.

## Workflow Contract

<!-- BEGIN GENERATED BEHAVIOR CONTRACT -->
> Generated from `workflow-specs/behaviors.json`. This block is authoritative. Run `node scripts/generate-behavior-surfaces.mjs --write` after changing the IR; if explanatory text below conflicts, fail closed.

### Generated Behavior Index

- **Purpose:** Align understanding and identify unknowns or risks without proposing solutions.
- **Canonical inputs:** `INPUT`(required aliases=REQUEST,CONTEXT); `PERSPECTIVE`(optional aliases=MODE default="observer" exact="observer","reviewer")
- **Decision entries:** 2; exact routes: `explore-lite`, `explore-review`.
- **Workflow steps:** `resolve-input` → `route` → `analyze` → `emit`
- **Output:** mode=`chat`; order=`observations or what is clear` → `uncertainties or review questions` → `potential risks or risk signals`; severity=none.
- **Deviation/failure:** mode=`forbid`; failure order=`status` → `missing input` → `allowed values` → `safe next action`.
- **Full IR:** `runtime/contracts/explore.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

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

## Detailed Contract

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
<PERSPECTIVE>

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

#### 4.0 VARIANT PROFILES

- Default or `PERSPECTIVE=observer`: normal read-only exploration.
- `PERSPECTIVE=reviewer`: former `explore-review` behavior.
- `DEPTH=lite`: former `explore-lite` behavior.
- `DEPTH=deep`: former `senior-explore` behavior; `EXPORT_PATH` requires explicit artifact-write scope and the shared safety preflight.

Compatibility command presets are defaults only; explicit non-conflicting user inputs win. Runtime contracts remain the complete behavior source for each variant.

#### END OF COMMAND

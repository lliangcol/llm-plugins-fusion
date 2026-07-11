---
name: nova-explore-lite
description: Lightweight observer-style exploration for quick understanding alignment.
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
argument-hint: "Example: explore-lite on this log snippet."
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:explore-lite` and the deprecated `/nova-plugin:nova-explore-lite` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

## Detailed Contract

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

---
name: nova-review-only
description: "Standard-depth review for correctness, performance, concurrency, failures, tests, and maintainability."
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
argument-hint: "Example: review-only INPUT='payment callback module'"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:review-only` and the deprecated `/nova-plugin:nova-review-only` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

Run regular strict review and output severity-grouped issues.

### Inputs

| Parameter | Required | Default | Notes                  | Example                   |
| --------- | -------- | ------- | ---------------------- | ------------------------- |
| `INPUT`   | Yes      | N/A     | Code/design/tests/logs | `fulfillment module diff` |

### Outputs

- `Critical`, `Major`, `Minor` findings.
- Each finding includes issue, impact, and directional improvement.

### Workflow

1. Review across standard dimensions.
2. Separate facts from assumptions.
3. Emit structured severity output.

### Examples

- Natural trigger: `Use review-only for this core path change.`
- Explicit trigger: `review-only INPUT="stock service patch"`.

### Safety

- No concrete code fixes.
- Do not expand scope beyond input.

## Detailed Contract

### REVIEW ONLY, NO IMPLEMENTATION

TASK: REVIEW ONLY — NO IMPLEMENTATION

You are Claude Code acting as a **strict reviewer / senior engineer**.

This command is for **analysis and review only**.
You MUST NOT write, modify, or propose concrete code changes.

---

#### INPUT

Analyze the following:

$ARGUMENTS

Inputs may include:

- Code snippets or files
- Design or implementation descriptions
- Test code
- Logs or error cases

Assume the input is the **current state** under review.

---

#### REVIEW DIMENSIONS

Review the input for:

- Correctness
- Overengineering or unnecessary complexity
- Performance issues
- Concurrency / thread safety risks
- Error handling and failure modes
- Test coverage and test quality
- Maintainability and long-term readability

---

#### STRICT RULES

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

#### OUTPUT FORMAT (MANDATORY)

Group all findings by severity:

##### Critical

- Issues that may cause:
  - Data corruption
  - Security or financial risk
  - Production instability
  - Incorrect business behavior

##### Major

- Issues that:
  - Significantly affect maintainability, scalability, or correctness
  - May lead to bugs under realistic conditions
  - Increase long-term cost

##### Minor

- Issues that:
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

- Neutral
- Precise
- Review-oriented
- No persuasive or defensive language

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

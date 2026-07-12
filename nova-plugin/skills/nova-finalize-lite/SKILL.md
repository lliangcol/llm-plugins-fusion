---
name: nova-finalize-lite
description: "Minimal close-out summary: what changed, why, and known limitations."
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
argument-hint: "Example: finalize-lite summarize this completed patch"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:finalize-lite` and the deprecated `/nova-plugin:nova-finalize-lite` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

- **Purpose:** Provide a short factual closure summary without making new changes or decisions.
- **Canonical inputs:** `WORK_SUMMARY`(required aliases=WORK_SCOPE)
- **Decision entries:** 2.
- **Workflow steps:** `freeze-scope` → `summarize` → `limitations`
- **Output:** mode=`chat`; order=`What changed` → `Why` → `Limitations`; severity=none.
- **Deviation/failure:** mode=`forbid`; failure order=`status` → `missing evidence` → `safe next action`.
- **Full IR:** `runtime/contracts/finalize-lite.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

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

## Detailed Contract

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

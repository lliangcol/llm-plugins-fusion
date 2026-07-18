---
name: nova-review
description: Unified canonical review Skill. Apply LEVEL and MODE to review depth and output shape; no code modification.
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
argument-hint: "Example: review LEVEL=standard MODE=findings-only REVIEW_SCOPE='small PR diff'"
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:review` and the deprecated `/nova-plugin:nova-review` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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
> Generated from `workflow-specs/behaviors.v2.json`. This block is authoritative. Run `node scripts/generate-behavior-surfaces.mjs --write` after changing the IR; if explanatory text below conflicts, fail closed.

### Generated Behavior Index

- **Purpose:** Perform evidence-grounded code or design review at the requested depth and output mode without implementation.
- **Canonical inputs:** `REVIEW_SCOPE`(required aliases=INPUT,SCOPE); `LEVEL`(optional aliases=DEPTH default="standard" exact="lite","standard","strict"); `MODE`(optional default="full" exact="full","findings-only"); `REVIEW_PROFILE`(optional default="general" exact="general","plan","codex-review-only","codex-verify-only")
- **Resolved variant authority:** `{"REVIEW_PROFILE":"codex-review-only"} normalized={"LEVEL":"standard","MODE":"full","REVIEW_PROFILE":"codex-review-only"} -> runtime/contracts/codex-review-only.json`; `{"REVIEW_PROFILE":"codex-verify-only"} normalized={"LEVEL":"standard","MODE":"full","REVIEW_PROFILE":"codex-verify-only"} -> runtime/contracts/codex-verify-only.json`; `{"REVIEW_PROFILE":"plan"} normalized={"LEVEL":"standard","MODE":"full","REVIEW_PROFILE":"plan"} -> runtime/contracts/plan-review.json`; `{} normalized={"LEVEL":"standard","MODE":"full","REVIEW_PROFILE":"general"} -> runtime/contracts/review.json`; `{"LEVEL":"lite"} normalized={"LEVEL":"lite","MODE":"full","REVIEW_PROFILE":"general"} -> runtime/contracts/review-lite.json`; `{"LEVEL":"standard","MODE":"findings-only"} normalized={"LEVEL":"standard","MODE":"findings-only","REVIEW_PROFILE":"general"} -> runtime/contracts/review-only.json`; `{"LEVEL":"strict"} normalized={"LEVEL":"strict","MODE":"full","REVIEW_PROFILE":"general"} -> runtime/contracts/review-strict.json`. Declared selector defaults are applied before matching. An exact normalized override wins; a non-exact combination that triggers an alias specialization stops as conflicting, and only a valid combination that triggers no specialization uses the canonical fallback. The complete resolved runtime contract is authoritative and no field falls back to canonical prose.
- **Claude static-entrypoint gate:** Native command and Skill frontmatter are static. A matching command wrapper may continue after it has verified that its invoked command id equals `resolvedWorkflowId`; this canonical Skill must not re-resolve or reject that validated wrapper. Only when this canonical Skill is itself the Claude native invoked entrypoint and no validated wrapper gate exists must `resolvedWorkflowId` equal `review`. Otherwise STOP before tools or side effects and invoke the exact direct command `/nova-plugin:<resolved commandEntrypoint.directCommandId>`; never execute the specialized contract under unmatched canonical frontmatter. Generic and Codex adapters may execute the resolved contract directly under adapter enforcement.
- **Decision entries:** 7; canonical routes and variants: `review {"REVIEW_PROFILE":"plan"}`, `review {"REVIEW_PROFILE":"codex-review-only"}`, `review {"REVIEW_PROFILE":"codex-verify-only"}`, `review {"MODE":"findings-only"}`, `review {"LEVEL":"lite"}`, `review {"LEVEL":"standard"}`, `review {"LEVEL":"strict"}`.
- **Workflow steps:** `resolve-scope` → `route` → `inspect` → `emit`
- **Output:** mode=`chat`; order=`findings` → `impact rationale` → `directional guidance`; severity=`Critical`, `Major`, `Minor`.
- **Deviation/failure:** mode=`forbid`; failure order=`status` → `missing input` → `allowed values` → `safe next action`.
- **Full IR:** `runtime/contracts/review.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Provide structured review findings for code/design artifacts through one
canonical surface, with depth and output shape selected by parameters.

### Inputs

Resolve `LEVEL`, `MODE`, and `REVIEW_PROFILE` first, then use the matched
runtime contract's required-input set:

| Resolved profile | Selector | Required inputs |
| --- | --- | --- |
| General review | `{}` | `REVIEW_SCOPE` |
| Lite review | `{"LEVEL":"lite"}` | `REVIEW_SCOPE` |
| Findings-only review | `{"LEVEL":"standard","MODE":"findings-only"}` | `REVIEW_SCOPE` |
| Strict review | `{"LEVEL":"strict"}` | `REVIEW_SCOPE` |
| Plan review | `{"REVIEW_PROFILE":"plan"}` | `PLAN_INPUT_PATH` |
| Codex review-only | `{"REVIEW_PROFILE":"codex-review-only"}` | `REVIEW_SCOPE` |
| Codex verify-only | `{"REVIEW_PROFILE":"codex-verify-only"}` | `REVIEW_FILE` |

`REVIEW_SCOPE` is not a universal requirement: plan review uses
`PLAN_INPUT_PATH`, while Codex verify-only uses `REVIEW_FILE`.

For the general, lite, findings-only, and strict profiles, `REVIEW_SCOPE` must
materialize the evidence as supplied text or as an explicit readable file/path
set. A label such as “current branch”, “this PR”, or “the diff against main” is
not itself review evidence because this Skill has no Bash permission to resolve
Git state. Stop and request patch text or an explicit readable file/path set.
Mention the Codex review-only profile only as an optional alternative when the
user explicitly asks for external Codex review; never switch profiles
automatically.

### Outputs

- `MODE=full`: complete review output at the selected `LEVEL`.
- `MODE=findings-only`: stop after prioritized findings at the selected `LEVEL`.
- `standard` and `strict` use severity buckets through `Critical`, `Major`, `Minor`.
- Directional suggestions only.

### Workflow

1. Parse and materialize scope, `LEVEL`, `MODE`, and `REVIEW_PROFILE`; stop on
   semantic branch/diff labels that do not include patch text or readable paths.
2. Keep the selected identity as canonical `nova-review`; apply depth and
   output shape as structured parameters.
3. Emit findings with impact rationale, stopping after findings when
   `MODE=findings-only`.

### Examples

- Natural trigger: `Use review on this core module change.`
- Explicit trigger: `review LEVEL=standard INPUT="inventory service diff"`.

### Safety

- No implementation patches.
- Clearly label facts vs assumptions.

## General Review Guidance

Review only materialized evidence in the resolved scope. Stop on semantic Git
labels without patch text or readable paths. Distinguish evidence, inference,
and assumptions; do not modify code, redesign, broaden scope, or invoke an
external Codex profile unless the user explicitly selected it.

Depth expands from high-signal correctness and test gaps (`lite`), through
complexity, performance, concurrency, failure modes, and maintainability
(`standard`), to security, integrity, boundaries, evolution, and operational
resilience (`strict`). Full output groups `Critical`, `Major`, then `Minor` and
states evidence, impact, and conceptual direction.

`LEVEL=lite` selects the bounded review. `/nova-plugin:review-only` remains the
direct `LEVEL=standard MODE=findings-only` compatibility entrypoint; automatic routing must not select the alias. Codex profiles require their complete resolved contract plus
separate shell, network, and authentication approval. Canonical read-only Skill frontmatter does not authorize that external runtime. All variants remain
non-implementation workflows.

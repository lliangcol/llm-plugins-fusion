---
name: nova-route
description: "Read-only workflow routing skill. Use when a request needs the next nova command, skill, core agent, capability packs, required inputs, and validation path selected before work starts."
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
argument-hint: "Example: route this request to the right nova command and packs."
---

## Shared Execution Policy

This file is the supporting behavioral contract for `/nova-plugin:route` and the deprecated `/nova-plugin:nova-route` compatibility entrypoint. Prefer the direct command; the compatibility name remains only for the current major-version migration window.

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

- **Purpose:** Choose the shortest safe next workflow route before execution starts.
- **Canonical inputs:** `REQUEST`(required aliases=INPUT,INTENT); `DEPTH`(optional aliases=MODE default="normal" exact="brief","normal")
- **Resolved variant authority:** `{} normalized={} -> runtime/contracts/route.json`. Declared selector defaults are applied before matching. An exact normalized override wins; a non-exact combination that triggers an alias specialization stops as conflicting, and only a valid combination that triggers no specialization uses the canonical fallback. The complete resolved runtime contract is authoritative and no field falls back to canonical prose.
- **Claude static-entrypoint gate:** Native command and Skill frontmatter are static. A matching command wrapper may continue after it has verified that its invoked command id equals `resolvedWorkflowId`; this canonical Skill must not re-resolve or reject that validated wrapper. Only when this canonical Skill is itself the Claude native invoked entrypoint and no validated wrapper gate exists must `resolvedWorkflowId` equal `route`. Otherwise STOP before tools or side effects and invoke the exact direct command `/nova-plugin:<resolved commandEntrypoint.directCommandId>`; never execute the specialized contract under unmatched canonical frontmatter. Generic and Codex adapters may execute the resolved contract directly under adapter enforcement.
- **Decision entries:** 19; canonical routes and variants: `implement-plan {"EXECUTION_PROFILE":"codex-review-fix"}`, `review {"REVIEW_PROFILE":"codex-review-only"}`, `review {"REVIEW_PROFILE":"codex-verify-only"}`, `explore {"DEPTH":"deep"}`, `explore {"PERSPECTIVE":"reviewer"}`, `explore {}`, `produce-plan {"PLAN_PROFILE":"java-backend"}`, `review {"REVIEW_PROFILE":"plan"}`, `produce-plan {"PLAN_PROFILE":"lite"}`, `produce-plan {}`, `review {"LEVEL":"strict"}`, `review {"LEVEL":"lite"}`, `review {"LEVEL":"standard","MODE":"findings-only"}`, `review {}`, `implement-plan {}`, `implement-plan {"EXECUTION_PROFILE":"lite"}`, `implement-plan {"EXECUTION_PROFILE":"standard"}`, `finalize-work {"DEPTH":"lite"}`, `finalize-work {}`.
- **Workflow steps:** `resolve-intent` → `classify` → `select` → `verify-surface` → `emit`
- **Output:** mode=`chat`; order=`Canonical skill` → `Command entrypoint` → `Variant parameters` → `Core agent` → `Capability packs` → `Required inputs` → `Validation expectations` → `Fallback path`; severity=none.
- **Deviation/failure:** mode=`forbid`; failure order=`status` → `ambiguous intent` → `required choice` → `safe fallback`.
- **Full IR:** `runtime/contracts/route.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Choose the next workflow step before work starts. It improves routing for agents that do not invoke Claude Code slash commands.

### Inputs

| Parameter | Required | Default | Notes |
| --- | --- | --- | --- |
| `REQUEST` | Yes | N/A | User intent and available execution basis; `INPUT` and `INTENT` are aliases |
| `DEPTH` | No | `normal` | `brief` or `normal`; `MODE` is an alias |

### Routing Table

| Request signal | Command entrypoint | Canonical skill | Variant preset | Core agent | Pack hints |
| --- | --- | --- | --- | --- | --- |
| Understand facts, unknowns, or risk only | `/nova-plugin:explore` | `nova-explore` | `{}` | `orchestrator` or `reviewer` | Domain packs from context |
| Deep investigation or analysis artifact | `/nova-plugin:senior-explore` | `nova-explore` | `{"DEPTH":"deep"}` | `architect` or `reviewer` | Domain packs from context |
| Write a reviewable plan | `/nova-plugin:produce-plan` | `nova-produce-plan` | `{}` | `architect` | `docs`, plus domain packs |
| Lightweight task outline | `/nova-plugin:plan-lite` | `nova-produce-plan` | `{"PLAN_PROFILE":"lite"}` | `architect` | Domain packs from context |
| Review code, plan, or risk | `/nova-plugin:review` | `nova-review` | `{}` | `reviewer` | `security`, `dependency`, `frontend`, `marketplace`, or other domain packs |
| Implement approved plan | `/nova-plugin:implement-plan` | `nova-implement-plan` | `{}` | `builder` | Domain packs from touched files |
| Implement explicit steps | `/nova-plugin:implement-standard` | `nova-implement-plan` | `{"EXECUTION_PROFILE":"standard"}` | `builder` | Domain packs from touched files |
| Small low-risk fix | `/nova-plugin:implement-lite` | `nova-implement-plan` | `{"EXECUTION_PROFILE":"lite"}` | `builder` | Domain packs from touched files |
| Codex review/fix/verify loop | `/nova-plugin:codex-review-fix` | `nova-implement-plan` | `{"EXECUTION_PROFILE":"codex-review-fix"}` | `reviewer` then `builder` then `verifier` | Domain packs from diff |
| Delivery summary or handoff | `/nova-plugin:finalize-work` | `nova-finalize-work` | `{}` | `publisher` | `release`, `docs`, `marketplace` when metadata changed |

Specialized and compatibility commands are direct entrypoints, not automatic
route identities. After selecting a canonical route plus validated variant
parameters, report the exact matching command entrypoint. Claude must use that
direct command whenever the resolved workflow differs from the invoked
canonical wrapper because native frontmatter is static. Generic and Codex
adapters may execute the resolved contract directly under adapter enforcement.
Compatibility entrypoints cannot retire until the product-level
`native-permission-and-invocation-parity` gate and every other governed
migration gate are satisfied.

| Specialized signal | Command entrypoint | Canonical skill | Variant preset | Core agent | Pack hints |
| --- | --- | --- | --- | --- |
| Need only a route recommendation | `/nova-plugin:route` | `nova-route` | `{}` | `orchestrator` | Packs implied by request context |
| Lightweight fact gathering | `/nova-plugin:explore-lite` | `nova-explore` | `{"PERSPECTIVE":"observer","DEPTH":"lite"}` | `orchestrator` | Domain packs from context |
| Exploration scoped to review readiness | `/nova-plugin:explore-review` | `nova-explore` | `{"PERSPECTIVE":"reviewer"}` | `reviewer` | `security`, `dependency`, or domain packs |
| Review an implementation plan before edits | `/nova-plugin:plan-review` | `nova-review` | `{"REVIEW_PROFILE":"plan"}` | `reviewer` | `docs`, `security`, or domain packs |
| Java/Spring backend plan | `/nova-plugin:backend-plan` | `nova-produce-plan` | `{"PLAN_PROFILE":"java-backend"}` | `architect` | `java`, `security`, `dependency` |
| Fast review with bounded depth | `/nova-plugin:review-lite` | `nova-review` | `{"LEVEL":"lite"}` | `reviewer` | Domain packs from diff |
| Review-only artifact or findings | `/nova-plugin:review-only` | `nova-review` | `{"LEVEL":"standard","MODE":"findings-only"}` | `reviewer` | `security`, `dependency`, or domain packs |
| Strict/high-risk review | `/nova-plugin:review-strict` | `nova-review` | `{"LEVEL":"strict"}` | `reviewer` | `security`, `dependency`, plus domain packs |
| Codex read-only review artifact | `/nova-plugin:codex-review-only` | `nova-review` | `{"REVIEW_PROFILE":"codex-review-only"}` | `reviewer` | Domain packs from diff |
| Codex verification of existing review | `/nova-plugin:codex-verify-only` | `nova-review` | `{"REVIEW_PROFILE":"codex-verify-only"}` | `verifier` | Domain packs from review scope |
| Lightweight closeout | `/nova-plugin:finalize-lite` | `nova-finalize-work` | `{"DEPTH":"lite"}` | `publisher` | `docs` or `release` when relevant |

### Output Format

```markdown
## Recommended Route

- Canonical skill:
- Command entrypoint:
- Variant parameters:
- Core agent:
- Capability packs:
- Required inputs:
- Validation expectations:
- Fallback path:
```

`Required inputs` names the selected downstream workflow's canonical inputs,
not the route command's own `REQUEST`. Use the exact UPPER_SNAKE_CASE names
from the generated behavior contract and runtime contract. Always list the
complete ordered required-input set even when values are already present,
inferable, or resolved; never list only unresolved inputs. Do not translate
the names into prose or substitute aliases.

For `DEPTH=normal`, include a one-sentence rationale inside the appropriate
fixed field. For `DEPTH=brief`, keep every field concise. Do not add content
outside the heading and eight fixed bullets.

Always output exactly one immediate next step. If the request spans later
stages, describe those stages only as prose inside `Validation expectations`
or `Fallback path`; do not add another canonical skill, command entrypoint, or
variant-parameter identity.

### Routing Rules

- Emit exactly one immediate next canonical route and matching command entrypoint.
- Automatic routing selects only one of the six canonical workflow targets;
  compatibility entrypoints are never the selected route identity.
- For read-only or findings-only intent, select canonical `review` with `{"LEVEL":"standard","MODE":"findings-only"}` and report `/nova-plugin:review-only` as the exact Claude command entrypoint.
- Use only existing capability packs: `java`, `security`, `dependency`, `docs`, `release`, `marketplace`, `frontend`, and `mcp`.
- Route source-grounding and official-documentation work through `docs`, `mcp`, or the relevant domain pack.
- Route doubt-driven high-risk review through `security`, `dependency`, or the relevant domain pack, with `reviewer` ownership.
- Route deprecation and migration planning through `release`, with `architect` and `publisher` ownership as needed.
- Do not invent commands, skills, packs, agents, validation claims, or implementation steps.

### Safety

- Do not modify project files.
- Do not create route artifacts unless a future command explicitly adds a write-capable route variant.
- Do not run implementation, test, Git, install, network, or external review commands.
- Do not claim a validation command passed; only name what should be run by the selected downstream workflow.

## Common Rationalizations

| Rationalization | Required Response |
| --- | --- |
| "The user asked to implement, so routing is unnecessary." | If the execution basis is missing or ambiguous, recommend the safest next command before implementation. |
| "No pack exactly matches this domain." | Choose the closest existing pack and state the fallback evidence instead of inventing a new pack. |
| "This route is obvious, so no required inputs are needed." | Still name the minimum inputs required for the selected downstream command. |
| "I can include an implementation outline to be helpful." | Keep the output to routing, inputs, validation expectations, and fallback path. |

## Red Flags

- The response includes code edits, plan details, or implementation steps.
- The response names a command, skill, pack, or agent that does not exist.
- A write-capable command is recommended without naming approval or execution-basis requirements.
- Validation is described as already passed.
- Domain routing creates new pack names instead of using the existing 8-pack set.

## Verification

- [ ] `REQUEST` was resolved or the missing input was named.
- [ ] The selected route is one of the six product-declared canonical targets;
  the exact matching command entrypoint is present, and variant
  parameters validate against the generated selector schema and resolution
  rule.
- [ ] The core agent is one of `orchestrator`, `architect`, `builder`, `reviewer`, `verifier`, or `publisher`.
- [ ] Capability packs are selected only from the existing pack set.
- [ ] Required inputs use the selected workflows' exact canonical UPPER_SNAKE_CASE names and validation expectations are explicit.
- [ ] The output is read-only and does not include implementation work.

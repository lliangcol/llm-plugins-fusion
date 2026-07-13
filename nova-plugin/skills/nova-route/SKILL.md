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
- **Decision entries:** 19; exact routes: `codex-review-fix`, `codex-review-only`, `codex-verify-only`, `senior-explore`, `explore-review`, `explore`, `backend-plan`, `plan-review`, `plan-lite`, `produce-plan`, `review-strict`, `review-lite`, `review-only`, `review`, `implement-plan`, `implement-lite`, `implement-standard`, `finalize-lite`, `finalize-work`.
- **Workflow steps:** `resolve-intent` → `classify` → `select` → `verify-surface` → `emit`
- **Output:** mode=`chat`; order=`Canonical skill` → `Command alias (optional)` → `Variant parameters` → `Core agent` → `Capability packs` → `Required inputs` → `Validation expectations` → `Fallback path`; severity=none.
- **Deviation/failure:** mode=`forbid`; failure order=`status` → `ambiguous intent` → `required choice` → `safe fallback`.
- **Full IR:** `runtime/contracts/route.json#behaviorContract` embeds the complete decision table, invariants, stops, field definitions, validation, and failure contract from the same source. Detailed guidance below may not override it.
<!-- END GENERATED BEHAVIOR CONTRACT -->

### Purpose

Choose the next workflow step before work starts. This skill improves routing quality for agents that do not natively invoke Claude Code slash commands.

### Routing Table

Use this as the first-stage keyword router before selecting the specific command.

| Intent family | Keyword signals | Primary route |
| --- | --- | --- |
| Explore | understand, investigate, clarify, unknowns, facts, risk, scope | `/nova-plugin:explore` or `/nova-plugin:senior-explore` |
| Plan | plan, design, proposal, approach, architecture, API shape, migration | `/nova-plugin:produce-plan`, `/nova-plugin:plan-lite`, or `/nova-plugin:backend-plan` |
| Review | review, audit, verify plan, risk check, security, dependency, PR feedback | `/nova-plugin:review`, `/nova-plugin:plan-review`, `/nova-plugin:codex-review-only`, or `/nova-plugin:codex-verify-only` |
| Implement | implement, fix, refactor, integrate, apply plan, change files | `/nova-plugin:implement-plan`, `/nova-plugin:implement-standard`, or `/nova-plugin:implement-lite` |
| Finalize | summarize, handoff, release notes, delivery, close out | `/nova-plugin:finalize-work` or `/nova-plugin:finalize-lite` |
| Codex loop | Codex, external review, review artifact, verify artifact, closed loop | `/nova-plugin:codex-review-fix`, `/nova-plugin:codex-review-only`, or `/nova-plugin:codex-verify-only` |

| Request signal | Optional command alias | Canonical skill | Variant preset | Core agent | Pack hints |
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

Specialized and compatibility commands are still valid routes. Use them only
when their narrower contract fits better than the primary command.

| Specialized signal | Optional command alias | Canonical skill | Variant preset | Core agent | Pack hints |
| --- | --- | --- | --- | --- |
| Need only a route recommendation | `/nova-plugin:route` | `nova-route` | `{}` | `orchestrator` | Packs implied by request context |
| Lightweight fact gathering | `/nova-plugin:explore-lite` | `nova-explore` | `{"PERSPECTIVE":"observer","DEPTH":"lite"}` | `orchestrator` | Domain packs from context |
| Exploration scoped to review readiness | `/nova-plugin:explore-review` | `nova-explore` | `{"PERSPECTIVE":"reviewer"}` | `reviewer` | `security`, `dependency`, or domain packs |
| Review an implementation plan before edits | `/nova-plugin:plan-review` | `nova-review` | `{"REVIEW_PROFILE":"plan"}` | `reviewer` | `docs`, `security`, or domain packs |
| Java/Spring backend plan | `/nova-plugin:backend-plan` | `nova-produce-plan` | `{"PLAN_PROFILE":"java-backend"}` | `architect` | `java`, `security`, `dependency` |
| Fast review with bounded depth | `/nova-plugin:review-lite` | `nova-review` | `{"LEVEL":"lite"}` | `reviewer` | Domain packs from diff |
| Review-only artifact or findings | `/nova-plugin:review-only` | `nova-review` | `{"LEVEL":"standard"}` | `reviewer` | `security`, `dependency`, or domain packs |
| Strict/high-risk review | `/nova-plugin:review-strict` | `nova-review` | `{"LEVEL":"strict"}` | `reviewer` | `security`, `dependency`, plus domain packs |
| Codex read-only review artifact | `/nova-plugin:codex-review-only` | `nova-review` | `{"REVIEW_PROFILE":"codex-review-only"}` | `reviewer` | Domain packs from diff |
| Codex verification of existing review | `/nova-plugin:codex-verify-only` | `nova-review` | `{"REVIEW_PROFILE":"codex-verify-only"}` | `verifier` | Domain packs from review scope |
| Lightweight closeout | `/nova-plugin:finalize-lite` | `nova-finalize-work` | `{"DEPTH":"lite"}` | `publisher` | `docs` or `release` when relevant |

### Output Format

```markdown
## Recommended Route

- Canonical skill:
- Command alias (optional):
- Variant parameters:
- Core agent:
- Capability packs:
- Required inputs:
- Validation expectations:
- Fallback path:
```

`Required inputs` names the selected downstream workflow's canonical inputs,
not the route command's own `REQUEST`. Use the exact UPPER_SNAKE_CASE names
from the generated behavior contract and runtime contract. Do not translate
them into prose or substitute aliases.

For `DEPTH=normal`, include a one-sentence rationale inside the appropriate
fixed field. For `DEPTH=brief`, keep every field concise. Do not add content
outside the heading and eight fixed bullets.

If the work requires a sequence, output the shortest safe sequence and keep the
same fixed fields for the immediate next step:

```markdown
## Recommended Route

- Canonical skill: `nova-explore` -> `nova-produce-plan` -> `nova-review`
- Command alias (optional): `/nova-plugin:explore` -> `/nova-plugin:produce-plan` -> `/nova-plugin:review`
- Variant parameters: `{}` -> `{}` -> `{}`
- Core agent: `orchestrator` -> `architect` -> `reviewer`
- Capability packs: packs implied by request context
- Required inputs: `INPUT`, then `REQUEST` and `PLAN_OUTPUT_PATH`, then `REVIEW_SCOPE`
- Validation expectations: each stage validates its artifact before the next stage
- Fallback path: stop at the first blocked stage and report the missing input
```

### Routing Rules

- Prefer a single next command when the next step is clear.
- Prefer the five primary workflow entries unless a compatibility or specialized command is clearly better.
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
- [ ] The canonical skill is one of the six 4.0 surfaces; any command alias and variant preset exist in the generated catalog.
- [ ] The core agent is one of `orchestrator`, `architect`, `builder`, `reviewer`, `verifier`, or `publisher`.
- [ ] Capability packs are selected only from the existing pack set.
- [ ] Required inputs use the selected workflows' exact canonical UPPER_SNAKE_CASE names and validation expectations are explicit.
- [ ] The output is read-only and does not include implementation work.

## 4.0 Skill-First Output

Emit `Canonical skill`, optional `Command alias`, `Variant parameters`, `Core agent`, `Capability packs`, `Required inputs`, `Validation expectations`, and `Fallback path`. Commands are generated compatibility wrappers and must never be treated as independent behavior sources.

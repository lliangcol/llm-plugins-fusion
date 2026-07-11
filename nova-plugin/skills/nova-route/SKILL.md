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

## Inputs

| Parameter | Required | Default | Notes |
| --- | --- | --- | --- |
| `REQUEST` | Yes | Remaining payload | User request, task summary, issue, diff context, or unclear workflow intent. |
| `CONTEXT` | No | None | Optional repository, file, branch, or artifact context. |
| `DEPTH` | No | normal | `normal` or `brief`; use `brief` for a single route recommendation. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to `REQUEST`.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; use only Read/Glob/Grep for local context discovery.
- Do not run Git, Bash, install, network, test, or external review commands from this skill.
- Safety-boundary parameters for this skill: none for this skill.
- In non-interactive mode, fail before side effects when required or safety-boundary parameters are missing.
- Full policy: `nova-plugin/skills/_shared/parameter-resolution.md`.

## Safety Preflight

- This skill is read-only for project files and must not modify code or write route artifacts.
- No interrupting preflight is required for ordinary Read/Glob/Grep usage.
- This skill has no export mode; a future write-capable route variant must be a separate command with explicit output parameters and shared preflight.
- Do not infer safety-boundary values for artifact exports, project edits, branch changes, or external tool invocation.
- Full policy: `nova-plugin/skills/_shared/safety-preflight.md`.

## Outputs

- Follow the skill-specific output rules below and the shared output contract.
- Chat output only; this skill must not write artifacts.
- Route reviews and verification requests to the appropriate downstream command instead of performing them.
- Full policy: `nova-plugin/skills/_shared/output-contracts.md`.
- Artifact policy: `nova-plugin/skills/_shared/artifact-policy.md`.

## Workflow

1. Resolve `REQUEST`, `CONTEXT`, and `DEPTH`.
2. Classify the request by workflow stage: Explore, Plan, Review, Implement, Finalize, or Codex loop.
3. Select the smallest suitable nova command and its one-to-one skill.
4. Select the owning core agent and any existing capability packs.
5. Identify required inputs that block safe execution.
6. State validation expectations and fallback mode.
7. Output the route recommendation only.

## Failure Modes

- Required payload is missing or too vague to route safely.
- The request asks for direct implementation, but approval, plan, branch, or safety-boundary inputs are missing.
- The request maps to multiple stages and needs a sequence rather than one command.
- A requested domain has no dedicated pack; route to the closest existing pack and state the fallback evidence.
- Existing user changes or missing local context prevent confident ownership selection.

## Examples

- Use `/nova-plugin:route` before a large or ambiguous task to choose the next nova command.
- Use `/nova-plugin:route` when consuming nova skills from Cursor, Gemini CLI, OpenCode, Copilot, Codex, or another agent without Claude slash commands.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

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

| Request signal | Command | Skill | Core agent | Pack hints |
| --- | --- | --- | --- | --- |
| Understand facts, unknowns, or risk only | `/nova-plugin:explore` | `nova-explore` | `orchestrator` or `reviewer` | Domain packs from context |
| Deep investigation or analysis artifact | `/nova-plugin:senior-explore` | `nova-senior-explore` | `architect` or `reviewer` | Domain packs from context |
| Write a reviewable plan | `/nova-plugin:produce-plan` | `nova-produce-plan` | `architect` | `docs`, plus domain packs |
| Lightweight task outline | `/nova-plugin:plan-lite` | `nova-plan-lite` | `architect` | Domain packs from context |
| Review code, plan, or risk | `/nova-plugin:review` | `nova-review` | `reviewer` | `security`, `dependency`, `frontend`, `marketplace`, or other domain packs |
| Implement approved plan | `/nova-plugin:implement-plan` | `nova-implement-plan` | `builder` | Domain packs from touched files |
| Implement explicit steps | `/nova-plugin:implement-standard` | `nova-implement-standard` | `builder` | Domain packs from touched files |
| Small low-risk fix | `/nova-plugin:implement-lite` | `nova-implement-lite` | `builder` | Domain packs from touched files |
| Codex review/fix/verify loop | `/nova-plugin:codex-review-fix` | `nova-codex-review-fix` | `reviewer` then `builder` then `verifier` | Domain packs from diff |
| Delivery summary or handoff | `/nova-plugin:finalize-work` | `nova-finalize-work` | `publisher` | `release`, `docs`, `marketplace` when metadata changed |

Specialized and compatibility commands are still valid routes. Use them only
when their narrower contract fits better than the primary command.

| Specialized signal | Command | Skill | Core agent | Pack hints |
| --- | --- | --- | --- | --- |
| Need only a route recommendation | `/nova-plugin:route` | `nova-route` | `orchestrator` | Packs implied by request context |
| Lightweight fact gathering | `/nova-plugin:explore-lite` | `nova-explore-lite` | `orchestrator` | Domain packs from context |
| Exploration scoped to review readiness | `/nova-plugin:explore-review` | `nova-explore-review` | `reviewer` | `security`, `dependency`, or domain packs |
| Review an implementation plan before edits | `/nova-plugin:plan-review` | `nova-plan-review` | `reviewer` | `docs`, `security`, or domain packs |
| Java/Spring backend plan | `/nova-plugin:backend-plan` | `nova-backend-plan` | `architect` | `java`, `security`, `dependency` |
| Fast review with bounded depth | `/nova-plugin:review-lite` | `nova-review-lite` | `reviewer` | Domain packs from diff |
| Review-only artifact or findings | `/nova-plugin:review-only` | `nova-review-only` | `reviewer` | `security`, `dependency`, or domain packs |
| Strict/high-risk review | `/nova-plugin:review-strict` | `nova-review-strict` | `reviewer` | `security`, `dependency`, plus domain packs |
| Codex read-only review artifact | `/nova-plugin:codex-review-only` | `nova-codex-review-only` | `reviewer` | Domain packs from diff |
| Codex verification of existing review | `/nova-plugin:codex-verify-only` | `nova-codex-verify-only` | `verifier` | Domain packs from review scope |
| Lightweight closeout | `/nova-plugin:finalize-lite` | `nova-finalize-lite` | `publisher` | `docs` or `release` when relevant |

### Output Format

```markdown
## Recommended Route

- Command:
- Skill:
- Core agent:
- Capability packs:
- Required inputs:
- Validation expectations:
- Fallback path:
```

For `DEPTH=normal`, add a one-sentence rationale after the fixed fields. For
`DEPTH=brief`, output only the fixed fields.

If the work requires a sequence, output the shortest safe sequence and keep the
same fixed fields for the immediate next step:

```markdown
## Recommended Route

1. `/nova-plugin:explore` -> `nova-explore`
2. `/nova-plugin:produce-plan` -> `nova-produce-plan`
3. `/nova-plugin:review` -> `nova-review`
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
- [ ] The command and skill exist and preserve one-to-one naming.
- [ ] The core agent is one of `orchestrator`, `architect`, `builder`, `reviewer`, `verifier`, or `publisher`.
- [ ] Capability packs are selected only from the existing pack set.
- [ ] Required inputs and validation expectations are explicit.
- [ ] The output is read-only and does not include implementation work.

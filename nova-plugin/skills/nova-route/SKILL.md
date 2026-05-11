---
name: nova-route
description: "Read-only workflow routing skill. Use when a request needs the next nova command, skill, core agent, capability packs, required inputs, and validation path selected before work starts."
license: MIT
allowed-tools: Read Glob Grep LS
argument-hint: "Example: route this request to the right nova command and packs."
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
| `REQUEST` | Yes | Remaining payload | User request, task summary, issue, diff context, or unclear workflow intent. |
| `CONTEXT` | No | None | Optional repository, file, branch, or artifact context. |
| `DEPTH` | No | normal | `normal` or `brief`; use `brief` for a single route recommendation. |

## Parameter Resolution

- Parse natural-language payload, explicit `KEY=value`, `--flag value`, and `--flag=value` forms from `$ARGUMENTS`.
- Normalize parameter names to uppercase snake case and map known mode words before assigning remaining text to `REQUEST`.
- Explicit values win over inferred values only when they do not conflict with another explicit value.
- Apply documented defaults only when unambiguous; use only Read/Glob/Grep/LS for local context discovery.
- Do not run Git, Bash, install, network, test, or external review commands from this skill.
- Safety-boundary parameters for this skill: none for this skill.
- In non-interactive mode, fail before side effects when required or safety-boundary parameters are missing.
- Full policy: `nova-plugin/skills/_shared/parameter-resolution.md`.

## Safety Preflight

- This skill is read-only for project files and must not modify code or write route artifacts.
- No interrupting preflight is required for ordinary Read/Glob/Grep/LS usage.
- If the workflow is extended to write an explicit artifact or invoke Bash, run the shared preflight first.
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

- Use `/route` before a large or ambiguous task to choose the next nova command.
- Use `/route` when consuming nova skills from Cursor, Gemini CLI, OpenCode, Copilot, Codex, or another agent without Claude slash commands.
- Explicit parameters may use `KEY=value` or `--flag value`; natural-language payload is accepted when unambiguous.

## Skill-Specific Guidance

### Purpose

Choose the next workflow step before work starts. This skill improves routing quality for agents that do not natively invoke Claude Code slash commands.

### Routing Table

| Request signal | Command | Skill | Core agent | Pack hints |
| --- | --- | --- | --- | --- |
| Understand facts, unknowns, or risk only | `/explore` | `nova-explore` | `orchestrator` or `reviewer` | Domain packs from context |
| Deep investigation or analysis artifact | `/senior-explore` | `nova-senior-explore` | `architect` or `reviewer` | Domain packs from context |
| Write a reviewable plan | `/produce-plan` | `nova-produce-plan` | `architect` | `docs`, plus domain packs |
| Lightweight task outline | `/plan-lite` | `nova-plan-lite` | `architect` | Domain packs from context |
| Review code, plan, or risk | `/review` | `nova-review` | `reviewer` | `security`, `dependency`, `frontend`, `marketplace`, or other domain packs |
| Implement approved plan | `/implement-plan` | `nova-implement-plan` | `builder` | Domain packs from touched files |
| Implement explicit steps | `/implement-standard` | `nova-implement-standard` | `builder` | Domain packs from touched files |
| Small low-risk fix | `/implement-lite` | `nova-implement-lite` | `builder` | Domain packs from touched files |
| Codex review/fix/verify loop | `/codex-review-fix` | `nova-codex-review-fix` | `reviewer` then `builder` then `verifier` | Domain packs from diff |
| Delivery summary or handoff | `/finalize-work` | `nova-finalize-work` | `publisher` | `release`, `docs`, `marketplace` when metadata changed |

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

If the work requires a sequence, output the shortest safe sequence:

```markdown
## Recommended Route

1. `/explore` -> `nova-explore`
2. `/produce-plan` -> `nova-produce-plan`
3. `/review` -> `nova-review`
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

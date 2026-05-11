# Thin Harness, Fat Skills Workflow Doctrine

Status: active
Date: 2026-05-12

This document extracts durable workflow guidance from Saito's X article on
Garry Tan's AI-agent development practice and adapts it for `nova-plugin`.
It does not vendor `gstack`, copy its prompts, or adopt promotional productivity
claims as project facts. The reusable lesson is a placement rule: keep runtime
orchestration thin, put judgment-heavy operating procedure in skills, and keep
private consumer facts outside this public repository.

Source inputs:

- Saito's X article shared from
  [x.com/SaitoWu/status/2052967845626290326](https://x.com/SaitoWu/status/2052967845626290326).
- Public `gstack` repository context from
  [github.com/garrytan/gstack](https://github.com/garrytan/gstack).

## Why This Exists

`nova-plugin` already has commands, one-to-one skills, core agents, capability
packs, prompt templates, and validation scripts. What was missing was an
explicit decision rule for where new workflow knowledge belongs.

The article's useful insight is that AI-assisted engineering shifts the scarce
resource from typing code to directing work. A strong workflow therefore needs
clear direction, rich context where it matters, visible planning artifacts, and
independent verification. It does not need a large custom runtime for every new
idea.

## Core Doctrine

Use this default unless a specific repo contract says otherwise:

1. Keep the harness thin.
2. Make skills and prompts fat enough to carry expert process.
3. Put deterministic checks in scripts and validators.
4. Put private facts in the consumer project.
5. Spend context deliberately where it buys evidence, not noise.
6. Require plans, diagrams, checkpoints, and verification before claiming done.

## Placement Rule

| Workflow material | Best home | Rationale |
| --- | --- | --- |
| Stable file layout, schema, generated-output drift, frontmatter checks | Script or validator | Deterministic, repeatable, and cheap to run in CI. |
| Role behavior, review heuristics, planning sequence, failure signals, output contract | `SKILL.md` or prompt template | Judgment-heavy and easier for an agent to follow as natural language. |
| Project commands, paths, private validation commands, endpoints, business rules | Consumer `AGENTS.md`, `CLAUDE.md`, `.claude/`, or private docs | Public docs must stay reusable and free of private context. |
| Cross-tool handoff summaries, review checkpoints, test plans, deployment notes | Artifact under the consumer workbench | Durable, resumable, and safer than relying on chat history. |
| Visual HTML artifacts for plans, reviews, reports, or handoffs | Prompt template plus consumer workbench | High-value presentation format, but not a reason to add a new command or runtime by default. |
| Optional domain hints such as Java, security, release, frontend, dependency, MCP | Capability pack | Routing context without forcing a runtime dependency. |
| Browser, shell, Codex, or external tool invocation details | Command/skill safety section plus script when deterministic | Keeps side effects explicit and auditable. |

When in doubt, ask: "Is this deterministic enough to test as code?" If yes,
prefer a script or validator. If no, express it as a skill, prompt, rubric, or
artifact contract.

## Context Investment

The article describes aggressive context use as a productivity lever. For this
project, translate that into context investment, not indiscriminate prompt
growth.

Spend context on:

- acceptance criteria and non-goals;
- relevant diffs, changed files, and Git facts;
- local `AGENTS.md` or `CLAUDE.md` rules;
- prior checkpoints, review artifacts, and validation output;
- docs or source files needed to prove behavior;
- diagrams that make data flow, state, ownership, and user paths explicit.

Do not spend context on:

- full repository scans when a scoped diff is enough;
- long pasted files or generated output that can be referenced by path;
- private consumer facts in public docs;
- repeated conversation history that should have become an artifact;
- speculative background that does not affect the current decision.

The goal is not to minimize tokens. The goal is to buy higher-confidence
execution with the smallest context that still contains the necessary evidence.

## Diagram-First Planning

For non-trivial implementation, require a visible structure artifact before
code changes. The artifact can be ASCII, Mermaid, or a short table, but it must
make the implementation shape inspectable.

Use diagram-first planning when a task includes:

- multi-step user flows;
- state transitions;
- data transformations;
- permissions or trust boundaries;
- asynchronous work, retries, or idempotency;
- multiple agents, commands, or handoff artifacts.

Minimum planning artifact:

```text
Actors:
Inputs:
Outputs:
State or data flow:
Failure paths:
Validation points:
```

This does not replace the plan. It makes the plan harder to misunderstand.

## Skill Quality Rubric

Use this rubric when adding or revising `nova-plugin/skills/nova-*/SKILL.md`
or a reusable prompt template.

| Rubric item | Good signal | Failure signal |
| --- | --- | --- |
| Trigger | A user or command can tell when to use it. | The skill overlaps several commands without routing rules. |
| Scope | Inputs, outputs, write permissions, and non-goals are explicit. | The skill can silently expand into broad repo work. |
| Safety | Read/write boundaries and destructive-action level are stated. | The skill can mutate code from a review-only path. |
| Procedure | Steps are ordered and small enough for an agent to execute. | The skill says "be thorough" without a method. |
| Evidence | Findings and decisions must cite files, diffs, docs, or validation. | The output can contain unsupported guesses. |
| Context | The skill names what to read and what to avoid. | It encourages full-history or full-repo loading by default. |
| Artifacts | Long work leaves checkpoints or handoff files. | Another agent must infer state from chat history. |
| Verification | Validation commands, skipped checks, and residual risk are recorded. | The final answer claims success without check evidence. |
| Fallback | Optional tools have plain-repo alternatives. | The workflow fails when an enhanced tool is unavailable. |
| Maintenance | The skill points to the right quality gate. | Behavior changes are not reflected in docs or changelog. |

## Metrics

Avoid using raw lines of code as the primary success metric. AI can inflate
output volume, and this project needs trust more than spectacle.

Prefer metrics such as:

- acceptance points completed;
- review findings prevented or resolved;
- validation gates passed;
- cycle time from plan to verified handoff;
- number of resumable artifacts created for long work;
- rework caused by missing context or weak skill instructions;
- public/private boundary violations caught before release.

Raw LOC can be a diagnostic signal only when normalized, explained, and paired
with shipped behavior and validation evidence.

## Application To `nova-plugin`

Current project mapping:

| Doctrine | Existing project surface | Maintenance action |
| --- | --- | --- |
| Thin harness | `scripts/*.mjs`, hook scripts, generated registry flow | Keep scripts deterministic and schema-backed. |
| Fat skills | `nova-plugin/skills/nova-*/SKILL.md` | Put role behavior, procedure, and output contracts here. |
| Command entrypoints | `nova-plugin/commands/*.md` | Keep command frontmatter and invocation mapping compact. |
| Role routing | `nova-plugin/agents/` and `nova-plugin/packs/` | Keep agents route-focused; keep packs documentation-only with fallback mode. |
| Context investment | `docs/workflows/context-safe-agent-workflows.md` | Split large work into units and checkpoints. |
| Consumer facts | `docs/consumers/` templates | Keep real commands, paths, and business rules in private consumer docs. |
| Prompt reuse | `docs/prompts/` | Add public-safe templates only when they are broadly reusable. |

## When To Create A New Skill Or Prompt

Create or revise a skill when all are true:

- the workflow repeats across projects or releases;
- the procedure contains judgment, sequencing, or role behavior;
- a short prompt is no longer enough to keep outputs consistent;
- the behavior can be validated by artifacts or quality gates;
- the public version can avoid private consumer facts.

Create a deterministic script instead when:

- the expected output can be checked exactly;
- failure should block CI or release;
- the logic is mostly parsing, counting, schema validation, or file drift
  detection.

Keep the workflow in a private consumer profile when:

- it depends on private domains, endpoints, credentials, environments, or
  business rules;
- it only applies to one closed-source project;
- publishing it would leak operational detail.

## Review Checklist

Before upstreaming new agent workflow guidance:

- Does it preserve command/skill one-to-one mapping when commands change?
- Does it keep public docs free of consumer-specific facts?
- Does it state whether the workflow may modify project files?
- Does it include output artifacts or checkpoints for long work?
- Does it name the smallest useful validation gate?
- Does it avoid treating optional tools as hard dependencies?
- Does it explain fallback behavior when enhanced tools are unavailable?
- Does it link to related public-safe templates instead of duplicating them?

## Related Prompt

Use [Skill Harness Audit Prompt](../prompts/common/skill-harness-audit.md) when
auditing a repeated workflow and deciding whether it belongs in a script,
skill, prompt template, capability pack, or consumer profile.

## Validation

For documentation-only edits to this doctrine:

```bash
node scripts/validate-docs.mjs
git diff --check
```

For command, skill, agent, pack, hook, schema, generated registry, or release
metadata changes, use the area-specific gates in [AGENTS.md](../../AGENTS.md).

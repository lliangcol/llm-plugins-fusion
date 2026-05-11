# Workbench Consumer Template

Status: active
Date: 2026-05-12

This is a public-safe template for a private consumer workbench. It describes
how a team or individual can keep requirements, plans, review artifacts,
implementation checkpoints, prompt templates, and delivery notes organized for
long-running AI-agent work.

Do not copy private consumer names, local absolute paths, private project
identifiers, repository addresses, endpoints, credentials, runtime flags,
business rules, or private knowledge base content into this public repository.
Fill concrete values only inside the private consumer workspace.

## Intended Use

Use a consumer workbench when one task spans multiple agent sessions or tools
and needs durable handoff artifacts. The workbench is not a replacement for the
source repository. It stores process assets that help Codex, Claude Code, human
reviewers, and later agents resume work without relying on chat history.

## Recommended Structure

```text
work/
|-- 0-inbox/
|-- 1-reqs/
|   `-- <domain>/<initiative>/
|-- 2-design/
|   `-- <domain>/<initiative>/
|       `-- html/
|-- 3-impl/
|   `-- <domain>/<initiative>/
|-- 4-test/
|   `-- <domain>/<initiative>/
|       |-- reviews/
|       |   `-- html/
|       |-- fixes/
|       |-- api/
|       |-- reports/
|       |   `-- html/
|       |-- testcases/
|       `-- deployment/
|-- 5-prompts/
|   |-- codex/
|   |-- claude-code/
|   `-- common/
|-- 6-workflows/
`-- 99-docs/
```

## Directory Roles

| Directory | Contents |
| --- | --- |
| `0-inbox/` | Unclassified notes, copied inputs, and files that still need triage. |
| `1-reqs/` | Requirements, requirements recap, acceptance checklist, open questions. |
| `2-design/` | Technical design, API design, data model notes, architecture tradeoffs, and optional visual HTML planning artifacts under `html/`. |
| `3-impl/` | Implementation plans, fix checkpoints, code logic notes, local run notes. |
| `4-test/` | Review reports, verification artifacts, test plans, deployment notes, and optional visual HTML review or report artifacts under `html/` subdirectories. |
| `5-prompts/` | Private prompt variants adapted from [Prompt Template Library](../prompts/README.md). |
| `6-workflows/` | Team-specific workflow notes and tool handoff rules. |
| `99-docs/` | Stable reference material that is not tied to one active task. |

Optional `html/` directories are for private visual plans, review reports,
delivery reports, and handoff artifacts. Treat those HTML files as derived
reading artifacts; keep the durable Markdown checkpoint, source requirements,
review artifact, code diff, or validation output as the authority.

## Naming

Use names that sort and resume well:

```text
YYYYMMDD-<initiative>-<artifact>.md
YYYYMMDD-<initiative>-review-unit-01.md
YYYYMMDD-<initiative>-fix-checkpoint-01.md
YYYYMMDD-<initiative>-handoff.md
```

Avoid names that depend on chat order such as `final2.md`, `new.md`, or
`latest-real-final.md`. If a tool creates a `latest` pointer, keep the
timestamped artifact too.

## Task Index

Each initiative should have a short index file:

```markdown
# <Initiative> Index

Status:
Owner:
Source repository:
Current branch:
Primary docs:
- Requirements:
- Design:
- Review:
- Fix checkpoints:
- Test plan:
- Deployment notes:

Acceptance checklist:
- [ ] ...

Open questions:
- ...

Validation commands:
- Targeted:
- Full:
```

## Rule Precedence

When rules conflict, use the most local source of truth:

1. Consumer project `AGENTS.md` / `CLAUDE.md`.
2. Consumer workspace workflow notes.
3. User-global agent preferences.
4. Public `nova-plugin` templates and examples.

Public templates should never override explicit private project rules.

## Agent Handoff Rules

- Store long-running outputs as artifacts, not only in chat.
- Record what was read, changed, validated, skipped, and left open.
- Keep private project facts inside the private workspace.
- Keep public reusable prompts generic before upstreaming them.
- Prefer small checkpoints over one large report when context pressure is high.
- Use Git facts from the source repository to define code review and fix scope.

## Hygiene Checklist

Run this checklist before final handoff:

- Requirements and acceptance points are linked from the task index.
- Review artifacts list scope reviewed and not reviewed.
- Fix checkpoints identify findings addressed and files changed.
- Test plan records executed and skipped validation.
- Deployment notes record config, migration, cache, monitoring, and rollback
  concerns when applicable.
- No private artifacts were copied into the public workflow repository.

## Related Templates

- [Context-Safe Agent Workflows](../workflows/context-safe-agent-workflows.md)
- [Prompt Template Library](../prompts/README.md)
- [Workbench tidy prompt](../prompts/common/workbench-tidy.md)

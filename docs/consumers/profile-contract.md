# Consumer Profile Contract

A consumer profile tells `nova-plugin` how to apply the generic workflow to a
specific project. The public repository defines the contract only; the real
profile belongs in the consumer's project-local `AGENTS.md`, `CLAUDE.md`,
`.claude/`, or private documentation.

Profiles should be short, operational, and safe to quote in local agent
sessions. If a field would require sensitive details, keep the public template
generic and store the concrete value only in the private consumer project.

## Required Fields

| Field | Required content | Public-safe example |
| --- | --- | --- |
| Project type | The kind of consumer project and its scope. | `private Java/Spring backend consumer` |
| Rules source | The files or private docs that define local rules. | `project-local AGENTS.md / CLAUDE.md as source of truth` |
| Tech stack | Frameworks, build tools, and runtime families. | `Java, Spring Boot, Maven, relational database` |
| Default workflow | The preferred nova command path for normal changes. | `/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work` |
| Default validation commands | Local checks agents should prefer before handoff. | `mvn test`, `npm test`, or `project-provided validation script` |
| High-risk change categories | Changes that require stricter planning, review, or validation. | `schema changes`, `auth changes`, `transactional writes` |
| Capability packs | Packs that should be considered for the project. | `java`, `frontend`, `security`, `dependency` |
| Out-of-scope boundaries | Work the public workflow must not infer or perform. | `do not use private project rules unless present in project-local docs` |

## Minimal Profile Shape

Use this shape inside the private consumer project and fill in only the details
that are safe for that project-local context.

```markdown
# Consumer Profile

## Project Type

- <private Java/Spring backend consumer | private frontend application | other>

## Rules Source

- Treat project-local `AGENTS.md` / `CLAUDE.md` as the source of truth.
- Read private project docs only when they are present in the current workspace.
- Do not import rules from unrelated repositories or public examples.

## Tech Stack

- Language/runtime:
- Frameworks:
- Build tools:
- Test tools:
- Data or integration boundaries:

## Default Workflow

- Explore: `/explore`
- Plan: `/produce-plan`
- Review: `/review`
- Implement: `/implement-plan`
- Finalize: `/finalize-work`

## Default Validation Commands

- Targeted:
- Broader:
- Release or handoff:

## High-Risk Change Categories

- Data model or schema changes.
- Authentication, authorization, or permission checks.
- Transactional writes, concurrency, idempotency, or retry behavior.
- External integration contracts.
- Build, dependency, or deployment-sensitive configuration.

## Capability Packs

- Primary:
- Secondary:

## Out-of-Scope Boundaries

- Do not expose private names, paths, identifiers, repository addresses,
  network endpoints, runtime flags, credentials, or configuration values in
  public artifacts.
- Do not assume project workflow details that are not documented in the
  project-local source of truth.
- Do not write public repository docs from private consumer facts.
```

## Usage Rules

- Keep the public profile contract generic and redacted.
- Keep concrete project facts in the consumer repository or private docs.
- Prefer the five main `nova-plugin` workflow entries for routine work:
  `/explore`, `/produce-plan`, `/review`, `/implement-plan`, and
  `/finalize-work`.
- Treat other commands as advanced or compatibility entries unless the consumer
  profile explicitly selects them.
- Run validation commands from the consumer profile when available; otherwise,
  report the missing validation source instead of inventing project-specific
  commands.

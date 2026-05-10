# Consumer Profile Templates

This directory documents the public, redacted contract for connecting
`nova-plugin` to downstream consumer projects. The repository should contain
only generic workflow guidance, consumer profile shapes, and sanitized examples.

Real consumer profiles must live in the consumer project itself, such as its
project-local `AGENTS.md`, `CLAUDE.md`, `.claude/` directory, or private
documentation. Do not copy closed-source project names, paths, private
identifiers, private configuration values, network endpoints, runtime flags,
private repository addresses, private knowledge base content, or real project
workflow details into this public repository.

## Documents

| Document | Purpose |
| --- | --- |
| [profile-contract.md](profile-contract.md) | Required fields and public-safe rules for any consumer profile. |
| [private-java-backend-template.md](private-java-backend-template.md) | Redacted template for a private Java/Spring backend consumer. |
| [frontend-project-template.md](frontend-project-template.md) | Redacted template for a private frontend application. |

## Public Repository Boundary

This repository may describe:

- Generic `nova-plugin` workflow entry points.
- Public-safe consumer profile contracts.
- Redacted Java backend and frontend templates.
- General pack guidance that applies across projects.

This repository must not describe:

- A closed-source consumer's real name, local path, private identifiers, or
  repository addresses.
- Private environment configuration, network endpoints, credentials, runtime
  flags, or deployment details.
- Private knowledge base content or real project workflows.
- Consumer-specific validation commands unless they are fully generic examples.

## Recommended Consumer Setup

Each consumer project should keep its own project profile close to the source
code and treat it as the source of truth for local rules:

```text
consumer-project/
|-- AGENTS.md              # AI agent guidance and source of truth
|-- CLAUDE.md              # Claude Code guidance, if used
|-- .claude/               # Private command, hook, or agent configuration
`-- private-docs/          # Optional private implementation notes
```

The public templates here are starting points only. Consumer maintainers should
replace placeholders inside their private project and keep sensitive details out
of public docs, prompts, generated artifacts, and review summaries.

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
| [workbench-template.md](workbench-template.md) | Public-safe template for organizing private requirements, plans, reviews, checkpoints, prompts, and handoff artifacts. |
| [cursor-setup.md](cursor-setup.md) | Public-safe guidance for consuming nova skills from Cursor rules. |
| [gemini-cli-setup.md](gemini-cli-setup.md) | Public-safe guidance for consuming nova skills from Gemini CLI context or skills. |
| [opencode-setup.md](opencode-setup.md) | Public-safe guidance for OpenCode intent-to-skill routing. |
| [copilot-setup.md](copilot-setup.md) | Public-safe guidance for GitHub Copilot instructions and persona mapping. |
| [codex-setup.md](codex-setup.md) | Public-safe guidance for Codex and Codex loop skill consumption. |

## Public Repository Boundary

This repository may describe:

- Generic `nova-plugin` workflow entry points.
- Public-safe consumer profile contracts.
- Redacted Java backend and frontend templates.
- General pack guidance that applies across projects.
- Generic workbench structure and prompt-template guidance for private
  consumer artifacts.
- Generic cross-tool setup guidance for Cursor, Gemini CLI, OpenCode, Copilot,
  Codex, and other agents that consume Markdown instructions.

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

## Scaffold A Private Profile

Maintainers can dry-run a profile scaffold from these templates without adding
dependencies:

```bash
node scripts/scaffold-consumer-profile.mjs --type java-backend --out ../consumer-project
node scripts/scaffold-consumer-profile.mjs --type frontend --out ../consumer-project
node scripts/scaffold-consumer-profile.mjs --type workbench --out ../consumer-project
```

The command is dry-run by default. Add `--write` only when the output directory
is a consumer-owned workspace. Generated files contain placeholders only; fill
private facts inside that consumer workspace, not in this public repository.

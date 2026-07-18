# Repository Documentation Index

Status: active
Date: 2026-07-17

This is the repository-level map for maintained public documentation under
`docs/`. Use [nova-plugin/docs/README.md](../nova-plugin/docs/README.md) for
plugin-specific user docs, command docs, and current plugin architecture notes.
Canonical local indexes live in the maintained information architecture below;
compatibility stubs are redirects, not documentation owners.

## Public Navigation Boundary

`docs/tutorials/` and `docs/templates/` are public-safe learning and reuse
surfaces, not a public portal or real consumer case-study library. Tutorials
explain reusable scenario workflows; templates provide redacted fixtures,
rubrics, prompts, profiles, and evidence records. Keep consumer-specific profiles,
endpoints, credentials, local paths, runtime flags, business rules,
private repository addresses, and private knowledge-base content in the
consumer-owned workspace.

Pre-v5 paths such as `docs/showcase/`, `docs/examples/`, `docs/consumers/`, and
`docs/prompts/` are governed compatibility stubs only. They must not be used as
current directory owners or as labels for canonical links.

## Start Here

| Need | Canonical entry |
| --- | --- |
| Choose the shortest path by persona or task | [getting-started/README.md](getting-started/README.md) |
| Run the first `nova-plugin` workflow | [getting-started/first-workflow.md](getting-started/first-workflow.md) |
| Install for Claude Code | [getting-started/install-claude-code.md](getting-started/install-claude-code.md) |
| Browse scenario-based examples | [tutorials/README.md](tutorials/README.md) |
| Adopt the framework in a private project | [guides/assistants/README.md](guides/assistants/README.md) |
| Build a second product | [guides/framework/second-product.md](guides/framework/second-product.md) |
| Split large work into resumable units | [guides/workflows/context-safe.md](guides/workflows/context-safe.md) |
| Design source-controlled checks | [guides/workflows/source-controlled-checks.md](guides/workflows/source-controlled-checks.md) |
| Understand framework and compiler boundaries | [reference/architecture/framework.md](reference/architecture/framework.md) |
| Understand core-agent and pack routing | [reference/architecture/agent-routing.md](reference/architecture/agent-routing.md) |
| Understand compatibility guarantees | [reference/compatibility/README.md](reference/compatibility/README.md) |
| Inspect workflow quality evidence | [reference/evaluation/benchmark.md](reference/evaluation/benchmark.md) |
| Understand local audit logs and data handling | [reference/security/data-handling.md](reference/security/data-handling.md) |
| Reuse consumer-profile templates | [templates/consumer-profiles/README.md](templates/consumer-profiles/README.md) |
| Reuse public-safe prompts | [templates/prompts/README.md](templates/prompts/README.md) |
| Prepare release evidence | [templates/evidence/release.md](templates/evidence/release.md) |
| Run maintainer checks | [operations/maintainers/README.md](operations/maintainers/README.md) |
| Find validation commands and CI ownership | [operations/maintainers/validation.md](operations/maintainers/validation.md) |
| Operate candidate-to-stable promotion | [operations/releases/runbook.md](operations/releases/runbook.md) |
| Maintain marketplace registry metadata | [operations/marketplace/registry-authoring.md](operations/marketplace/registry-authoring.md) |
| Review current project work | [project/plans/current-remediation.md](project/plans/current-remediation.md) |
| Inspect generated documentation navigation | [generated/documentation-navigation.md](generated/documentation-navigation.md) |
| Choose a command or inspect plugin docs | [nova-plugin/docs/README.md](../nova-plugin/docs/README.md) |

## Canonical Directory Map

```text
docs/
|-- README.md
|-- assets/          # media files referenced by maintained public docs
|-- generated/       # generated inventories, matrices, and reports
|-- getting-started/ # first-run and installation paths
|-- guides/          # task-oriented assistant, framework, and workflow guides
|-- marketplace/     # generated marketplace catalog
|-- operations/      # community, maintainer, marketplace, and release operations
|-- project/         # decisions, migrations, plans, and release notes
|-- reference/       # architecture, compatibility, evaluation, security, and workflow contracts
|-- templates/       # consumer profiles, evidence records, and prompts
`-- tutorials/       # public-safe examples and walkthroughs
```

## Directory Responsibilities

| Area | Owns |
| --- | --- |
| [assets/](assets/) | Public media assets referenced by maintained documentation. |
| [generated/](generated/) | Generated public inventories, navigation, matrices, and evidence reports. |
| [getting-started/](getting-started/) | Persona routing, installation, and the shortest first-workflow path. |
| [guides/](guides/) | Task-oriented assistant setup, framework adoption, and workflow guidance. |
| [marketplace/](marketplace/) | Generated human-readable marketplace catalog. |
| [operations/](operations/) | Community assets, maintainer checks, registry authoring, release gates, and recovery. |
| [project/](project/) | Architecture decisions, migrations, active plans, and release notes. |
| [reference/](reference/) | Architecture, compatibility, evaluation, security, and workflow contracts, including local audit-log data handling. |
| [templates/](templates/) | Public-safe consumer profiles, evidence records, and reusable prompts. |
| [tutorials/](tutorials/) | Redacted examples, walkthroughs, and workflow evaluation exercises. |

## Compatibility Stubs

Compatibility paths are listed in
[`governance/docs-migrations.json`](../governance/docs-migrations.json). Each
stub points to one canonical target and is retained only until the governed
retirement checks and version boundary are satisfied. Do not add maintained
content, new inbound links, or directory ownership claims to those paths.

## Maintenance Rules

- Add maintained content only under a canonical owner directory above.
- Update this index when a canonical top-level owner changes.
- Update `governance/docs-migrations.json` when a public path moves; run
  `node scripts/migrate-documentation-layout.mjs --write` to create or refresh
  compatibility stubs.
- Do not hand-edit generated files under `docs/generated/` or
  `docs/marketplace/catalog.md`; use their owning generators.
- Keep repository and plugin indexes on canonical link labels even while old
  public URLs remain available as stubs.
- After documentation changes, run `node scripts/validate-docs.mjs`.

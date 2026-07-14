<!-- migrated-from: docs/marketplace/portal-information-architecture.md -->
# Marketplace Portal Information Architecture

Status: preparation
Date: 2026-05-12

This document defines the information architecture for a future marketplace
portal. It is documentation-only preparation: it does not move `nova-plugin/`,
does not build a frontend site, and does not add release or deployment pipeline
dependencies. It is not an implemented public portal, hosted marketplace,
frontend app, deployment plan, or evidence that a public portal is active.

## Purpose

The portal should make the repository readable as a marketplace without mixing
future implementation work into the current published release boundary. The near-term
work is to name the data sources, content surfaces, and phase boundaries so
later portal work can be implemented from stable repository contracts.

## Source Boundaries

| Information | Source of truth | Portal use |
| --- | --- | --- |
| Marketplace name, owner, and description | `.claude-plugin/registry.source.json` and generated `.claude-plugin/marketplace.json` | Marketplace header and repository identity |
| Installable plugin entry | `.claude-plugin/marketplace.json` | Catalog card, install source, plugin display fields |
| Repository-local trust, risk, deprecation, maintainer, compatibility, and review metadata | `.claude-plugin/marketplace.metadata.json`, generated from `.claude-plugin/registry.source.json` | Trust badges, maintenance status, freshness indicators, review links |
| Human-readable catalog | `docs/marketplace/catalog.md`, generated from registry source and plugin manifests | Markdown catalog for users and reviewers |
| Plugin version, author, license, repository, homepage, and keywords | `nova-plugin/.claude-plugin/plugin.json` | Plugin detail page metadata |
| Commands and skills | `nova-plugin/commands/` and `nova-plugin/skills/nova-*/SKILL.md` | Capability summaries and command/skill counts |
| Command documentation | `nova-plugin/docs/commands/` | Detail links for users evaluating a plugin |
| Agents and capability packs | `nova-plugin/agents/` and `nova-plugin/packs/` | Routing and capability summaries |
| Release boundary and compatibility notes | `ROADMAP.md`, `docs/releases/release-hygiene.md`, and `docs/marketplace/multi-plugin-readiness.md` | Version-independent product-lane guidance and release evidence |

Portal implementation code must not become a new source of truth for these
fields. If generated portal pages are introduced later, they should consume
these repository sources rather than duplicate plugin metadata by hand.

## Portal Surfaces

| Surface | Audience | Content blocks | Data readiness |
| --- | --- | --- | --- |
| Marketplace home | Plugin users, authors, maintainers | Marketplace purpose, install snippet, current plugin count, trust model summary, route to catalog | Ready from current registry and README data |
| Plugin catalog | Plugin users | Plugin cards with name, version, category, tags, risk, trust, deprecated status, maintainer, last updated, install source, compatibility evidence | Ready as generated Markdown catalog; multi-plugin repository layout deferred |
| Plugin detail | Plugin users and authors | Description, install command, metadata, command map, skill map, agents, packs, compatibility notes, docs links | Ready for `nova-plugin`; reusable layout only |
| Compatibility matrix | Maintainers and advanced users | Claude Code install compatibility, Codex prerequisites, Bash and Node.js requirements, command/skill compatibility, optional enhanced tools | Ready from [Compatibility matrix](../../reference/compatibility/marketplace.md) |
| Contribution entry | Plugin authors | Registry source contract, plugin manifest contract, scaffold dry-run/profile workflow, validation commands, docs requirements | Ready from `CONTRIBUTING.md` and [Registry author workflow](../../operations/marketplace/registry-authoring.md) |
| Trust and maintenance policy | Maintainers | `trust-level`, `risk-level`, `deprecated`, `last-updated`, maintainer ownership, compatibility evidence, review links | Ready from [Trust policy](../../reference/security/marketplace-trust.md) and [Security review route](../../reference/security/security-review.md) |
| Roadmap and migration | Maintainers and authors | Current single-plugin boundary and version-independent multi-plugin activation criteria | Ready from roadmap, release hygiene, and [multi-plugin readiness](multi-plugin-readiness.md) |

## Navigation Model

The eventual portal can be represented as this route tree. These are IA labels,
not implementation paths:

```text
/
|-- catalog
|   `-- nova-plugin
|-- compatibility
|-- contribute
|-- trust
`-- roadmap
```

For the current repository, these map to Markdown and generated metadata:

| Portal label | Current repository entry |
| --- | --- |
| Home | `README.md` |
| Catalog | `docs/marketplace/catalog.md`, generated from `.claude-plugin/marketplace.json` plus `.claude-plugin/marketplace.metadata.json` |
| `nova-plugin` detail | `nova-plugin/docs/README.md` and command docs |
| Compatibility | `docs/marketplace/compatibility-matrix.md` and `docs/releases/release-hygiene.md` |
| Contribute | `CONTRIBUTING.md` and `docs/marketplace/registry-author-workflow.md` |
| Trust | `docs/marketplace/trust-policy.md`, `docs/marketplace/security-review-route.md`, `SECURITY.md`, metadata schema, and marketplace metadata |
| Roadmap | `ROADMAP.md` and `docs/marketplace/multi-plugin-readiness.md` |

## Phase Boundaries

The single-plugin portal preparation boundary was introduced in `v2.2.0` and
remains the current `v4.0.0` marketplace state. It adds routing, runtime smoke, distribution risk scanning, a
plugin install smoke script that must run only in CI or an isolated test-user
environment, consumer setup, and workflow artifact guidance. It does not require
a plugin path move or a public portal implementation. The breaking multi-plugin
repository layout remains a future major-version candidate requiring separate evidence.

| Phase | Portal commitment | Allowed work | Deferred work |
| --- | --- | --- | --- |
| v2.2.0 | Routing, runtime, and distribution safety hardening without changing the single-plugin marketplace boundary. | `/nova-plugin:route` and `nova-route`, runtime smoke validation, distribution risk scan, plugin install smoke script for CI or isolated test-user execution, consumer setup docs, prompt templates, Workbench template, and release evidence improvements. | Breaking repository layout changes, frontend implementation, Claude-incompatible metadata in the marketplace manifest. |
| v3.0.0 | Workflow, runtime, release, and adapter hardening while preserving the single production plugin boundary. | Canonical workflow spec, direct commands, assistant adapters, signed immutable release evidence. | Multi-plugin path migration and public portal implementation. |
| Future major | Optional multi-plugin marketplace structure only if real maintenance pressure justifies it. | `plugins/*` layout decision, migration plan, multi-plugin catalog, separately approved portal decision. | Treating path changes as silent internals or shipping without migration evidence. |

## Explicit Non-Goals For This Preparation

- Do not move, rename, or copy `nova-plugin/`.
- Do not build a React, Vite, Next.js, static-site, or other frontend portal.
- Do not add package dependencies, deployment jobs, release signing, SBOM,
  changesets, or release-please configuration.
- Do not change plugin versions or generated release metadata for portal
  preparation.
- Do not put repository-local fields such as `trust-level`, `risk-level`,
  `deprecated`, `last-updated`, `maintainer`, `compatibility`, or `review` into
  the Claude-compatible marketplace manifest.

## Acceptance Checks

- This document exists under `docs/marketplace/` and is linked from the project
  navigation.
- The current `v4.0.0` single-plugin boundary, its `v2.2.0` introduction, and
  the deferred future multi-plugin boundary are explicitly separated.
- The work remains documentation-only and does not introduce frontend or release
  pipeline dependencies.
- Generated catalog data remains derived from registry source and plugin
  manifests.
- `node scripts/validate-registry-fixtures.mjs` passes.
- `node scripts/validate-docs.mjs` passes.

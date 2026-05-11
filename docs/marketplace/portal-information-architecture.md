# Marketplace Portal Information Architecture

Status: preparation
Date: 2026-05-12

This document defines the information architecture for a future marketplace
portal. It is documentation-only preparation: it does not move `nova-plugin/`,
does not build a frontend site, and does not add release or deployment pipeline
dependencies.

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
| Release boundary and compatibility notes | `docs/releases/vnext-release-decision.md`, `ROADMAP.md`, and `docs/marketplace/v3-readiness-evidence.md` | Version-phase guidance and `v3.0.0` activation evidence |

Portal implementation code must not become a new source of truth for these
fields. If generated portal pages are introduced later, they should consume
these repository sources rather than duplicate plugin metadata by hand.

## Portal Surfaces

| Surface | Audience | Content blocks | Data readiness |
| --- | --- | --- | --- |
| Marketplace home | Plugin users, authors, maintainers | Marketplace purpose, install snippet, current plugin count, trust model summary, route to catalog | Ready from current registry and README data |
| Plugin catalog | Plugin users | Plugin cards with name, version, category, tags, risk, trust, deprecated status, maintainer, last updated, install source, compatibility evidence | Ready as generated Markdown catalog; multi-plugin repository layout deferred |
| Plugin detail | Plugin users and authors | Description, install command, metadata, command map, skill map, agents, packs, compatibility notes, docs links | Ready for `nova-plugin`; reusable layout only |
| Compatibility matrix | Maintainers and advanced users | Claude Code install compatibility, Codex prerequisites, Bash and Node.js requirements, command/skill compatibility, optional enhanced tools | Ready from [Compatibility matrix](compatibility-matrix.md) |
| Contribution entry | Plugin authors | Registry source contract, plugin manifest contract, scaffold dry-run/profile workflow, validation commands, docs requirements | Ready from `CONTRIBUTING.md` and [Registry author workflow](registry-author-workflow.md) |
| Trust and maintenance policy | Maintainers | `trust-level`, `risk-level`, `deprecated`, `last-updated`, maintainer ownership, compatibility evidence, review links | Ready from [Trust policy](trust-policy.md) and [Security review route](security-review-route.md) |
| Roadmap and migration | Maintainers and authors | vNext, v2.0.0, v2.1.0, v2.2.0, and v3.0.0 boundaries, breaking-change expectations, and activation evidence | Ready from roadmap, release decision doc, and [v3 readiness evidence](v3-readiness-evidence.md) |

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
| Compatibility | `docs/marketplace/compatibility-matrix.md` and `docs/releases/vnext-release-decision.md` |
| Contribute | `CONTRIBUTING.md` and `docs/marketplace/registry-author-workflow.md` |
| Trust | `docs/marketplace/trust-policy.md`, `docs/marketplace/security-review-route.md`, `SECURITY.md`, metadata schema, and marketplace metadata |
| Roadmap | `ROADMAP.md` and `docs/marketplace/v3-readiness-evidence.md` |

## Phase Boundaries

`vNext` is retained here as the completed pre-release preparation lane.
`docs/releases/vnext-release-decision.md` records the decision that shipped that
lane as `2.0.0`; the vNext portal commitments below therefore describe the
completed documentation-only preparation scope, while the `v2.0.0` row describes
the published active-agent compatibility boundary. The `v2.1.0` lane shipped
registry, author-workflow, trust, compatibility, and review-policy work. The
`v2.2.0` lane keeps the same single-plugin portal boundary while adding routing,
runtime smoke, distribution risk scanning, a plugin install smoke script that
must run only in CI or an isolated test-user environment, consumer setup, and
workflow artifact guidance. It does not require a plugin path move or a public
portal implementation. The breaking multi-plugin repository layout remains a
future `v3.0.0` candidate.

| Phase | Portal commitment | Allowed work | Deferred work |
| --- | --- | --- | --- |
| vNext | Information architecture only. Define source ownership, surfaces, navigation labels, and compatibility boundaries for the current single-plugin marketplace. | Markdown docs, roadmap links, validation with `node scripts/validate-docs.mjs`. | Public portal URL, frontend implementation, plugin path moves, version bump, release automation dependencies. |
| v2.0.0 | Active-agent compatibility boundary. Released the current 6-core-agent model as a clear major version without moving plugin paths. | Release metadata updates, changelog `BREAKING` notes, migration guidance, full repository validation. | Registry authoring expansion, frontend portal implementation, plugin path moves, release signing or SBOM pipeline requirements. |
| v2.1.0 | Registry, author workflow, trust, and review readiness. Make multi-entry registry data practical and make marketplace entries reviewable, maintainable, and risk-traceable. | Released: registry fixture validation, generated Markdown catalog, scaffold dry-run/profile docs, author workflow docs, compatibility matrix, trust policy, PR checklist, maintainer and compatibility evidence metadata, security review route, release hygiene docs. | Breaking repository layout changes, mandatory frontend stack, public portal deployment. |
| v2.2.0 | Routing, runtime, and distribution safety hardening without changing the single-plugin marketplace boundary. | `/route` and `nova-route`, runtime smoke validation, distribution risk scan, plugin install smoke script for CI or isolated test-user execution, consumer setup docs, prompt templates, Workbench template, and release evidence improvements. | Breaking repository layout changes, frontend implementation, Claude-incompatible metadata in the marketplace manifest. |
| v3.0.0 | Optional breaking marketplace structure. Move from single primary plugin layout to explicit multi-plugin repository layout only if real maintenance pressure justifies it. | `plugins/*` layout decision, `nova-plugin` migration plan, multi-plugin catalog, public portal implementation decision if separately approved. | Treating path changes as silent internals; shipping without migration docs and changelog `BREAKING` notes. |

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
- The `vNext`, `v2.0.0`, `v2.1.0`, `v2.2.0`, and `v3.0.0` boundaries are explicitly separated.
- The work remains documentation-only and does not introduce frontend or release
  pipeline dependencies.
- Generated catalog data remains derived from registry source and plugin
  manifests.
- `node scripts/validate-registry-fixtures.mjs` passes.
- `node scripts/validate-docs.mjs` passes.

# Marketplace Portal Information Architecture

Status: preparation
Date: 2026-05-05

This document defines the information architecture for a future marketplace
portal. It is documentation-only preparation: it does not move `nova-plugin/`,
does not build a frontend site, and does not add release or deployment pipeline
dependencies.

## Purpose

The portal should make the repository readable as a marketplace without mixing
future implementation work into the current release candidate. The near-term
work is to name the data sources, content surfaces, and phase boundaries so
later portal work can be implemented from stable repository contracts.

## Source Boundaries

| Information | Source of truth | Portal use |
| --- | --- | --- |
| Marketplace name, owner, and description | `.claude-plugin/registry.source.json` and generated `.claude-plugin/marketplace.json` | Marketplace header and repository identity |
| Installable plugin entry | `.claude-plugin/marketplace.json` | Catalog card, install source, plugin display fields |
| Repository-local trust, risk, deprecation, and freshness metadata | `.claude-plugin/marketplace.metadata.json`, generated from `.claude-plugin/registry.source.json` | Trust badges, maintenance status, freshness indicators |
| Plugin version, author, license, repository, homepage, and keywords | `nova-plugin/.claude-plugin/plugin.json` | Plugin detail page metadata |
| Commands and skills | `nova-plugin/commands/` and `nova-plugin/skills/nova-*/SKILL.md` | Capability summaries and command/skill counts |
| Command documentation | `nova-plugin/docs/commands/` | Detail links for users evaluating a plugin |
| Agents and capability packs | `nova-plugin/agents/` and `nova-plugin/packs/` | Routing and capability summaries |
| Release boundary and compatibility notes | `docs/releases/vnext-release-decision.md` and `ROADMAP.md` | Version-phase guidance |

Portal implementation code must not become a new source of truth for these
fields. If generated portal pages are introduced later, they should consume
these repository sources rather than duplicate plugin metadata by hand.

## Portal Surfaces

| Surface | Audience | Content blocks | Data readiness |
| --- | --- | --- | --- |
| Marketplace home | Plugin users, authors, maintainers | Marketplace purpose, install snippet, current plugin count, trust model summary, route to catalog | Ready from current registry and README data |
| Plugin catalog | Plugin users | Plugin cards with name, version, category, tags, risk, trust, deprecated status, last updated, install source | Single-plugin ready; multi-plugin behavior deferred |
| Plugin detail | Plugin users and authors | Description, install command, metadata, command map, skill map, agents, packs, compatibility notes, docs links | Ready for `nova-plugin`; reusable layout only |
| Compatibility matrix | Maintainers and advanced users | Claude Code install compatibility, Codex prerequisites, command/skill compatibility, active-agent compatibility | Ready from release decision doc |
| Contribution entry | Plugin authors | Registry source contract, plugin manifest contract, validation commands, docs requirements | Ready from `CONTRIBUTING.md` and schemas |
| Trust and maintenance policy | Maintainers | `trust-level`, `risk-level`, `deprecated`, `last-updated`, ownership and disclosure rules | Ready from metadata schema and security docs |
| Roadmap and migration | Maintainers and authors | vNext, v2.0.0, v2.1.0, v2.2.0, and v3.0.0 boundaries, breaking-change expectations | Ready from roadmap and release decision doc |

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
| Catalog | `.claude-plugin/marketplace.json` plus `.claude-plugin/marketplace.metadata.json` |
| `nova-plugin` detail | `nova-plugin/docs/README.md` and command docs |
| Compatibility | `docs/releases/vnext-release-decision.md` |
| Contribute | `CONTRIBUTING.md` |
| Trust | `SECURITY.md`, metadata schema, and marketplace metadata |
| Roadmap | `ROADMAP.md` |

## Phase Boundaries

`vNext` is used here as the current unreleased preparation lane, not as a
guaranteed SemVer number. `docs/releases/vnext-release-decision.md` proposes
shipping vNext as `2.0.0`; if that decision is accepted, the vNext portal
commitments below remain the pre-release scope, while the `v2.0.0` row describes
the active-agent compatibility boundary. The registry and author-workflow lane
moves to `v2.1.0`; trust, maintenance status, and review strategy move to
`v2.2.0`; and the breaking multi-plugin repository layout becomes a future
`v3.0.0` candidate.

| Phase | Portal commitment | Allowed work | Deferred work |
| --- | --- | --- | --- |
| vNext | Information architecture only. Define source ownership, surfaces, navigation labels, and compatibility boundaries for the current single-plugin marketplace. | Markdown docs, roadmap links, validation with `node scripts/validate-docs.mjs`. | Public portal URL, frontend implementation, plugin path moves, version bump, release automation dependencies. |
| v2.0.0 | Active-agent compatibility boundary. Release the current 6-core-agent model as a clear major version without moving plugin paths. | Release metadata updates, changelog `BREAKING` notes, migration guidance, full repository validation. | Registry authoring expansion, frontend portal implementation, plugin path moves, release signing or SBOM pipeline requirements. |
| v2.1.0 | Registry and author workflow readiness. Make multi-entry registry data practical and keep catalog fields generated from source files. | Registry generation hardening, scaffold documentation, author workflow docs, optional generated Markdown catalog if it has no new deploy dependency. | Trust policy expansion, breaking repository layout changes, mandatory frontend stack, public portal deployment. |
| v2.2.0 | Trust, maintenance status, and review strategy. Make marketplace entries reviewable, maintainable, and risk-traceable for external contributions. | Trust/risk/deprecation/last-updated policy docs, contribution checklist, compatibility evidence, security review route, release hygiene docs. | Breaking repository layout changes, frontend portal implementation, Claude-incompatible metadata in the marketplace manifest. |
| v3.0.0 | Optional breaking marketplace structure. Move from single primary plugin layout to explicit multi-plugin repository layout only if real maintenance pressure justifies it. | `plugins/*` layout decision, `nova-plugin` migration plan, multi-plugin catalog, public portal implementation decision if separately approved. | Treating path changes as silent internals; shipping without migration docs and changelog `BREAKING` notes. |

## Explicit Non-Goals For This Preparation

- Do not move, rename, or copy `nova-plugin/`.
- Do not build a React, Vite, Next.js, static-site, or other frontend portal.
- Do not add package dependencies, deployment jobs, release signing, SBOM,
  changesets, or release-please configuration.
- Do not change plugin versions or generated release metadata for portal
  preparation.
- Do not put repository-local fields such as `trust-level`, `risk-level`,
  `deprecated`, or `last-updated` into the Claude-compatible marketplace
  manifest.

## Acceptance Checks

- This document exists under `docs/marketplace/` and is linked from the project
  navigation.
- The `vNext`, `v2.0.0`, `v2.1.0`, `v2.2.0`, and `v3.0.0` boundaries are explicitly separated.
- The work remains documentation-only and does not introduce frontend or release
  pipeline dependencies.
- `node scripts/validate-docs.mjs` passes.

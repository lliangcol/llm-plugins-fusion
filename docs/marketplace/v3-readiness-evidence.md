# v3.0.0 Readiness Evidence

Status: active
Date: 2026-05-10

This document tracks whether the repository has enough real maintenance
pressure to start the deferred `v3.0.0` multi-plugin marketplace work described
in [ROADMAP.md](../../ROADMAP.md).

The current decision is to keep `v3.0.0` deferred. Evidence collection is active,
but the repository must not move `nova-plugin/`, introduce a public portal
frontend, or change plugin installation paths until the activation criteria
below are met.

The current priority is workflow framework + consumer profile templates. Public
docs may add generic profile contracts, redacted Java backend/frontend examples,
and pack guidance while `v3.0.0` remains deferred.

## Current Decision

| Area | Current evidence | Decision |
| --- | --- | --- |
| Plugin count | One production plugin: `nova-plugin`. Multi-entry behavior is covered by fixtures only. | Do not migrate real directories. |
| Plugin ownership | One maintainer cadence and no separate plugin owner model. | Do not split ownership paths. |
| Release cadence | `v2.1.0` shipped registry, trust, compatibility, and review work as one plugin release. | Keep single-plugin release flow. |
| Catalog needs | Generated Markdown catalog is sufficient for current browsing and review. | Do not build a frontend portal. |
| Registry operations | Source-driven generation and fixtures cover current metadata needs. | Continue validating fixtures before adding structure. |
| Consumer project support | Generic profiles and redacted examples can support private consumers without publishing private project facts. | Keep profiles as docs, not new plugins. |
| Domain workflows | Java and frontend needs are handled by capability packs and consumer profiles. | Do not add large `/java-*` or `/frontend-*` command families. |

## Activation Criteria

`v3.0.0` should only move from deferred to planned when at least one required
criterion has concrete evidence and the optional criteria have been considered.

| Criterion | Required | Evidence needed before activation |
| --- | --- | --- |
| Multiple real plugins | Yes | At least one additional installable plugin with its own manifest, docs, owner, and release requirements that cannot be maintained cleanly under the current layout. |
| Different release cadence | Yes | A documented need to release plugins independently without forcing unrelated `nova-plugin` version bumps or changelog noise. |
| Current layout friction | Yes | Repeated maintenance failures, confusing review diffs, or validation gaps caused by the single-plugin layout rather than by missing documentation. |
| Public portal demand | No | User or maintainer evidence that generated Markdown catalog and README navigation are no longer sufficient. |
| Release automation gap | No | Repeated manual release errors that cannot be solved by release hygiene, CI checks, or small script improvements. |
| Ecosystem submission need | No | A concrete submission or distribution target that requires a different repository or marketplace shape. |
| Domain command pressure | No | Repeated evidence that packs and consumer profiles cannot support Java or frontend work without new command families. |

## Evidence Log

| Date | Signal | Evidence | Decision impact |
| --- | --- | --- | --- |
| 2026-05-09 | Post-`v2.1.0` baseline | `v2.1.0` release completed with one production plugin, generated catalog, registry fixtures, and repository-local metadata. | Keep `v3.0.0` deferred. |
| 2026-05-10 | Consumer profile direction | Public docs added generic consumer profile contracts, redacted backend/frontend templates, and examples without adding plugins, owners, portal code, or command behavior changes. | Supports workflow framework direction while keeping `v3.0.0` deferred. |
| 2026-05-12 | `v2.2.0` release-ready evidence pass | Added release evidence drafts, scaffold and validation improvements, and pending workflow/archive records while keeping one production plugin and no public portal implementation. Exact `v2.2.0` tag and release workflow remain pending. | Keep `v3.0.0` deferred until real post-release maintenance pressure exists. |

## Allowed While Deferred

- Record concrete issue, PR, release, or maintainer evidence in this document.
- Extend registry fixtures when a proposed shape needs proof without moving real
  plugin directories.
- Improve generated Markdown catalog fields when the registry source already
  owns the data.
- Add non-breaking docs that clarify author workflow, trust review, or release
  hygiene.
- Add generic consumer profile contracts, redacted examples, and capability pack
  guidance that avoid private consumer facts.

## Not Allowed Without Activation

- Moving, renaming, or copying `nova-plugin/`.
- Introducing `plugins/*` as the production install path.
- Adding a frontend framework, deployment job, or public portal dependency.
- Changing plugin install commands or marketplace source paths.
- Adding large domain-specific command families such as `/java-*` or
  `/frontend-*` without evidence that packs and consumer profiles are
  insufficient.
- Treating fixture-only multi-plugin support as evidence that production
  migration is necessary.

## Review Cadence

Review this evidence after each minor release, after any proposed new plugin
entry, or when marketplace maintenance creates repeated friction that existing
validation and documentation cannot address.

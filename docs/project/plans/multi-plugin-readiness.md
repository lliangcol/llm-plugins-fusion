<!-- migrated-from: docs/marketplace/multi-plugin-readiness.md -->
# Production Multi-Plugin Readiness

Status: active
Date: 2026-07-12

This ledger tracks whether the `production-multi-plugin-layout` product lane in
`governance/product-lanes.json` has enough evidence to move from `deferred` to
`planned`. It is deliberately independent of plugin version numbers.

## Current Decision

The production layout remains single-plugin. `nova-plugin/` is the only public
production plugin path. Registry fixtures prove that generators can process
multiple entries; they do not prove that production directories, ownership,
release cadence, or installation paths should change.

## Required Activation Evidence

| Criterion | Required evidence |
| --- | --- |
| Multiple production plugins | At least two installable plugin specifications with separate owners and documented independent maintenance needs. |
| Generic contracts | Shared schemas and compiler logic contain no nova namespace or fixed-count assumptions. |
| Shared delivery | Both plugin instances use the same validation, evidence, and release-promotion contracts. |
| Independent implementation | At least one plugin or adapter is maintained outside the original nova-specific implementation path. |
| Demonstrated pressure | Repeated release, ownership, or review failures caused by the single-plugin layout rather than missing documentation. |

All five criteria are required. A public portal is a separate optional product
lane and cannot substitute for missing multi-plugin maintenance evidence.

## Evidence Log

| Date | Evidence | Decision impact |
| --- | --- | --- |
| 2026-05-09 | One production plugin, one maintainer cadence, and generated marketplace outputs. | Keep the production layout single-plugin. |
| 2026-05-12 | Consumer profiles and redacted examples supported multiple project types without new plugins. | Continue using profiles and packs for domain variation. |
| 2026-06-24 | Multi-entry fixtures gained duplicate-name, duplicate-source, and path-escape guards. | Strengthens generator readiness only. |
| 2026-07-12 | The 3.0.x line shipped workflow, security, SBOM, provenance, attestation, and release evidence while retaining one production plugin. | Separate released version history from the deferred product lane. |

## Allowed While Deferred

- Extend generic schemas and compiler tests without moving public paths.
- Exercise multi-entry fixtures and instance-level inventory contracts.
- Record concrete ownership, release-cadence, or maintenance evidence here.
- Keep generated catalogs and registry metadata compatible with future entries.

## Not Allowed Without Activation

- Moving, renaming, or copying the production `nova-plugin/` path.
- Treating `plugins/*` as a production install location.
- Claiming fixture-only behavior as a mature multi-plugin ecosystem.
- Coupling this product decision to a future version number.
- Adding a hosted portal, deployment stack, or broad command families as a
  substitute for missing maintenance evidence.

## Review Cadence

Review this ledger before any proposal that moves plugin paths, splits release
cadence, introduces a second production plugin, or changes registry ownership.
Otherwise, review it at each stable release without changing the decision in
the absence of new evidence.

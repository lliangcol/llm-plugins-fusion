# Control Plane and Evidence Boundaries

Status: active

This page is the horizontal map for contributors. It does not replace the
leaf architecture, validation, release, or compatibility documents.

| Surface | What it owns | Where it runs | Evidence boundary |
| --- | --- | --- | --- |
| `nova-plugin/` | The only production plugin: generated command wrappers, six canonical skills, six agents, eight documentation packs, hooks, and runtime contracts. | User installation/runtime. | Enters the plugin archive; distribution and secret scans apply. |
| Runtime guardrails | Pre/post tool launchers, workspace containment, secret redaction, shell policy, and audit handling. | Installed plugin runtime. | Bash launcher evidence is distinct from Node payload evidence. |
| Maintainer control plane | `scripts/`, `governance/`, `schemas/`, `tests/`, package scripts, and GitHub workflows. | Repository checkout and CI. | Does not enter the plugin archive. |
| Generated projections | Marketplace files, runtime contracts, catalogs, facts, and `docs/generated/`. | Generator plus drift validation. | Edit the authoritative source, never the projection. |
| External evidence | Isolated installs, authenticated read-only routes, live evaluations, platform runs, security services, and performance histories. | Credentialed or platform-specific CI/operator lanes. | Dynamic records stay in CI artifacts or candidate/control bundles unless a governed stable proof accepts a public-safe summary. |

The generated [control-plane inventory](../../generated/control-plane-inventory.md)
lists the current package scripts, runnable validation tasks, workflows,
governance sources, and generators. Current version and 21/6/6/8 inventory
facts remain generated from their authoritative sources through project-state
and fact synchronization; this page does not own those numbers.

Deferred product lanes remain non-capabilities: a public portal, production
multi-plugin layout, runtime dynamic pack loading, and broad domain command
expansion are not activated by this map.

## Evidence Strength

Static contracts and fixtures prove deterministic structure, not installation
or assistant behavior. Dry-runs prove local planning paths, not user-scope
mutation. Isolated install, authenticated read-only route, and versioned live
evaluation evidence are progressively stronger and must remain separately
named in release summaries.

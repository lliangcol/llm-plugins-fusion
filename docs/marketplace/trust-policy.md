# Marketplace Trust Policy

Status: active
Date: 2026-05-08

This policy defines repository-local marketplace metadata. These fields are
generated into `.claude-plugin/marketplace.metadata.json` and
`docs/marketplace/catalog.md`; they must not be copied into the
Claude-compatible `.claude-plugin/marketplace.json`.

## Field Semantics

| Field | Required meaning | Review requirement |
| --- | --- | --- |
| `trust-level` | Provenance of the plugin entry: `official`, `author-verified`, `community`, or `experimental` | Reviewer confirms the maintainer identity and that the level is not overstated. |
| `risk-level` | Expected operational risk: `low`, `medium`, or `high` | Reviewer checks write tools, Bash/scripts, hooks, network/dependency behavior, and security-sensitive flows. |
| `deprecated` | Whether users should avoid new installs | Deprecated entries need a replacement path, migration note, or removal rationale. |
| `last-updated` | Last published or release-ready metadata date in `YYYY-MM-DD` form | Date changes when the maintainer intentionally updates plugin metadata, trust/risk status, compatibility evidence, or release state as part of a release-ready registry update. |
| `maintainer` | Named owner responsible for review and follow-up | PRs must identify a maintainer name and contact path when available. |
| `compatibility` | Evidence links for commands, skills, docs, validation, and prerequisites | Links must resolve locally or be an intentional external project URL. |
| `review` | Links to trust policy, security review route, and release hygiene docs | Reviewers use these links as the policy entry points for the plugin. |

## Trust Levels

| Level | Use when |
| --- | --- |
| `official` | The repository owner maintains the plugin as a first-party entry. |
| `author-verified` | The plugin author or maintainer is known and reachable, but the plugin is not first-party. |
| `community` | The entry is community-maintained with reviewable source and a named owner. |
| `experimental` | The entry is early, incomplete, or intentionally unstable. |

## Risk Levels

| Level | Use when |
| --- | --- |
| `low` | Read-only or bounded workflow behavior, no unusual runtime dependency, and existing validation covers the change. |
| `medium` | Write-capable commands, hooks, Bash scripts, generated artifacts, dependency-sensitive behavior, or broader workflow impact. |
| `high` | Security-sensitive automation, credential handling, destructive operations, networked execution, or behavior that requires explicit maintainer approval. |

## Review Requirements

- Registry changes must update `.claude-plugin/registry.source.json` first, then
  regenerate outputs with `node scripts/generate-registry.mjs --write`.
- Generated files must not drift from source; `node scripts/validate-schemas.mjs`
  checks the generated marketplace, metadata, and catalog.
- Reviewers must verify that Claude-incompatible fields remain only in
  repository-local metadata.
- Security-sensitive changes follow
  [Security Review Route](security-review-route.md).
- Release or version changes follow
  [Release Hygiene](../releases/release-hygiene.md).

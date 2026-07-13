# Compatibility Summary

Status: active
Date: 2026-07-13

This page is the shortest public summary of install prerequisites, known-good
assistant lanes, latest drift monitoring, and evidence claim boundaries. The
detailed surface matrix remains in
[../marketplace/compatibility-matrix.md](../marketplace/compatibility-matrix.md).

## Current Stable Baseline

| Signal | Current source-controlled value | Source |
| --- | --- | --- |
| Stable plugin | `nova-plugin v4.0.0` | `governance/release-channels.json` |
| Stable tag | `v4.0.0` | `governance/release-channels.json` |
| Repository runtime | Node.js 22+ | `package.json` and `.node-version` |
| Distributed Bash helpers | Bash 3.2+ | `governance/project-state.generated.json` |
| Known-good Claude Code | `2.1.205` blocking lane | `governance/assistant-support.json` |
| Known-good Codex | `0.144.0-alpha.4` blocking lane | `governance/assistant-support.json` |
| Latest assistant versions | Non-blocking canary lanes | `governance/assistant-support.json` |

The known-good version is a controlled test lane, not a promise that every
feature has current L4 evidence. Generated compatibility evidence currently
declares Claude Code and Codex at L2 and generic assistants at L1. Older live
records remain historical when their source digests, exact-tag identity, or
adapter-load evidence no longer matches the current tree.

When credentials, budget, or a qualifying exact-tag run is absent, the status
is `declaration-only` or unavailable. A zero-sample report never upgrades a
compatibility or performance claim.

## Evidence Layers

| Layer | What it proves | What it does not prove |
| --- | --- | --- |
| Static contract | Metadata, schemas, generated adapters, and contracts parse and agree. | A real assistant invoked or enforced them. |
| Adapter simulation | Deterministic adapter routing and failure semantics. | Host integration under a live assistant version. |
| Known-good install smoke | A fixed assistant version can install the plugin in an isolated profile. | Latest-version compatibility or workflow output quality. |
| Latest canary | Detects ecosystem drift without blocking the stable lane. | A compatibility upgrade until evidence is reviewed and promoted. |
| Exact-tag live evidence | Observed behavior bound to assistant version, source tag, runner, dataset, and digests. | Future versions or untested consumer environments. |

## Check The Current Evidence

```bash
npm run validate:compatibility-evidence
node scripts/validate-plugin-install.mjs --dry-run
node scripts/validate-assistant-evidence.mjs
node scripts/validate-github-workflows.mjs
```

For release-asset verification, use the consumer steps in the
[maintainer release runbook](../maintainers/release-runbook.md#4-verify-as-a-consumer).

## Drift Handling

The scheduled/manual Plugin Install Smoke workflow keeps the fixed known-good
lane separate from `latest`. A latest-canary failure is a drift signal: record
or update the compatibility issue, investigate it, and do not silently upgrade
the stable claim. A fixed-lane failure blocks promotion until the compatible
version or repository contract is deliberately changed and revalidated.

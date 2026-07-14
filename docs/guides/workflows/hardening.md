<!-- migrated-from: docs/workflows/gsd-informed-hardening.md -->
# GSD-Informed Reliability Hardening

Status: active
Date: 2026-05-12

This document explains the reliability hardening work that was derived from a
comparative review of the GSD workflow style and adapted for `nova-plugin`.
It records what was adopted, what was deliberately not adopted, and how future
maintainers should validate these controls.

This is a public-safe maintenance note. Do not add private consumer names,
local paths, endpoints, credentials, repository addresses, runtime flags,
business rules, or private knowledge-base content.

## Purpose

The hardening work keeps `nova-plugin` focused as a compact marketplace plugin
while adopting useful reliability controls from broader AI workflow systems.
The goal is not to copy a larger command surface. The goal is to improve
routing accuracy, resumability, evidence quality, prompt-surface discipline,
and release confidence without weakening the repository's permission posture.

## Adopted Controls

| Control | Repository surface | Reason |
| --- | --- | --- |
| First-stage routing | `/nova-plugin:route`, `nova-route`, command docs, routing docs | Keep the first answer to ambiguous work as a read-only route recommendation, not an implementation plan. |
| Checkpoint artifact contract | `docs/prompts/common/checkpoint-artifact.md`, workbench template, artifact policy | Make long private consumer tasks resumable without depending on chat history. |
| Verification evidence contract | Shared output contracts, Codex verification prompt, workflow docs | Require validation claims to map back to behavior, repository facts, review findings, or change goals. |
| Prompt-surface budgets | `scripts/validate-surface-budget.mjs`, CI, npm shortcut, release evidence | Keep public command, skill, agent, and pack surfaces small enough to audit. |
| Distribution-risk expansion | `scripts/scan-distribution-risk.mjs`, regression tests, trust/security docs | Block high-risk blanket permission advice and tracked `.codex/` runtime artifacts from public distribution. |
| Windows CI smoke evidence | CI and release evidence docs | Prevent Windows local skipped Bash checks from being mistaken for a complete pass by separating Node/PowerShell and Bash smoke evidence. |

## Deliberately Not Adopted

The hardening work should not introduce:

- a broad command family that competes with the existing 21 command/skill pairs;
- a public portal or mature multi-plugin ecosystem claim without implementation
  evidence;
- default guidance to run with blanket permission bypasses;
- public storage of private consumer checkpoints or workbench artifacts;
- new active agent paths outside `nova-plugin/agents/`;
- generated marketplace edits by hand.

These exclusions preserve the current `nova-plugin` delivery model and the
public/private boundary described in [CLAUDE.md](../../../CLAUDE.md) and
[AGENTS.md](../../../AGENTS.md).

## Maintenance Rules

When changing these controls:

- Keep `/nova-plugin:route` read-only and first-stage.
- Preserve canonical skill ownership and generated command/preset projection.
- Update user-facing docs when command behavior, validation expectations, or
  safety boundaries change.
- Put reusable private-work resumability prompts under `docs/prompts/`, not in
  consumer-specific docs in this public repository.
- Keep evidence claims tied to observed behavior, repository facts, review
  findings, or change goals.
- Run the surface budget validator for command, skill, agent, or pack surface
  changes.
- Run the distribution-risk scan for public docs, prompts, scripts, or release
  artifact changes.
- Record release-impacting changes in `CHANGELOG.md`.

## Validation

For documentation-only maintenance:

```bash
node scripts/validate-docs.mjs
node scripts/scan-distribution-risk.mjs
git diff --check
```

For changes that alter scripts, CI, command behavior, skills, marketplace
metadata, or release gates:

```bash
node scripts/validate-all.mjs
```

`node scripts/validate-surface-budget.mjs` may report allowlisted warnings. A
warning is acceptable only when the allowlist entry has a reason and split
plan.

## Related Documents

- [Routing and Validation Guardrails](../../reference/workflows/routing-guardrails.md)
- [Verification Evidence Contract](../../reference/workflows/verification-evidence.md)
- [Context-Safe Agent Workflows](context-safe.md)
- [Checkpoint Artifact Prompt](../../templates/prompts/common/checkpoint-artifact.md)
- [Security Review Route](../../reference/security/security-review.md)
- [Trust Policy](../../reference/security/marketplace-trust.md)
- [Release Evidence Template](../../templates/evidence/release.md)
- [Release Validation Runbook](../../operations/releases/validation.md)
- [Project Optimization Plan](../../project/plans/current-remediation.md)

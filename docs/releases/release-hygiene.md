# Release Hygiene

Status: active
Date: 2026-05-12

This document defines the release and pre-release checks for marketplace and
plugin changes. Use it with the
[Release evidence template](release-evidence-template.md) and
[Release validation runbook](release-validation-runbook.md) before promoting a
tag or publishing release notes.

## Version And Tag Rules

- `nova-plugin/.claude-plugin/plugin.json` is the plugin version source of
  truth.
- Release tags must be `v<plugin-version>` and match `plugin.json` exactly.
- Stable promotion targets must be exact release tags. A moving `main` branch,
  especially one with `CHANGELOG.md` `Unreleased` content, is an unreleased
  development snapshot rather than stable release material.
- Do not create, overwrite, delete, or push public tags without explicit
  maintainer approval.
- A changelog release section is required before publishing a release.
- Unreleased local work may stay under `CHANGELOG.md` `Unreleased` until the
  maintainer decides the release version and date.

## Generated Artifact Rules

- Update `.claude-plugin/registry.source.json` and plugin manifests first.
- Regenerate derived files with:

```bash
node scripts/generate-registry.mjs --write
```

- Generated outputs currently include:
  `.claude-plugin/marketplace.json`,
  `.claude-plugin/marketplace.metadata.json`, and
  `docs/marketplace/catalog.md`.
- Do not hand-edit generated outputs to make validation pass.

## Required Checks

For broad release or workflow changes:

```bash
node scripts/generate-registry.mjs --write
node scripts/validate-all.mjs
node scripts/validate-runtime-smoke.mjs
node scripts/scan-distribution-risk.mjs
node scripts/validate-regression.mjs
git diff --check
```

Record the exact target, environment, validation results, skipped checks, and
promotion decision with
[Release evidence template](release-evidence-template.md).

When Bash is available, confirm hook syntax checks actually ran:

```bash
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

If Bash is not available on Windows, `node scripts/validate-all.mjs` may report
skipped Bash-dependent checks; do not describe hook syntax or runtime smoke as
locally passed in that case. CI/Linux must run the Bash syntax and runtime smoke
checks.

Run `node scripts/validate-plugin-install.mjs` only in CI or an isolated
test-user environment. It may install or update user-scope Claude plugin state,
so unattended local release evidence should record it as pending instead of
running it by default.

For the full manual sequence, including exact tag creation, isolated install
smoke cleanup, workflow evaluation recording, and final promotion decisions, use
[Release validation runbook](release-validation-runbook.md).

## Review Before Release

Before tagging, search for:

- Stale `release candidate`, `vNext`, or outdated version wording.
- Whether the target is an exact tag:
  `git describe --tags --exact-match HEAD`.
- Command, skill, agent, or pack counts that no longer match repository facts.
- Dead local links or anchors.
- Changelog/date/version drift.
- Generated marketplace, metadata, or catalog drift.
- `.codex/` runtime artifacts.
- Runtime smoke coverage for distributed Bash/Codex helper scripts.
- Distribution risk scan output for active private paths, credentials, JWTs,
  npm tokens, cloud provider keys, private network addresses, internal
  endpoints, private SSH repository URLs, and real `.env` values.
- Regression coverage for registry generation, distribution risk scanning, and
  command/skill/docs drift.
- Plugin install smoke evidence from CI or an isolated test-user environment,
  never from an unattended run that may mutate the operator's user-scope
  Claude plugin installation.
- For minor releases, whether the five primary commands were manually evaluated
  with `docs/examples/workflow-evaluation.md` and recorded with
  `docs/examples/workflow-evaluation-record-template.md`, or why that evidence
  is not applicable.

`node scripts/validate-docs.mjs` also checks that `SECURITY.md` declares the
current MINOR support range derived from `plugin.json`, and that active planning
tables do not keep stale `v1.x` future-version labels. Historical changelog
entries and explicitly archived paths are intentionally excluded from that
stale-planning scan.

Use [Registry Author Workflow](../marketplace/registry-author-workflow.md),
[Trust Policy](../marketplace/trust-policy.md), and
[Security Review Route](../marketplace/security-review-route.md) for the
review inputs.

# Release Hygiene

Status: active
Date: 2026-05-08

This document defines the release and pre-release checks for marketplace and
plugin changes. It complements the concrete `2.0.0` release runbook in
[v2.0.0 manual release steps](v2.0.0-manual-release-steps.md).

## Version And Tag Rules

- `nova-plugin/.claude-plugin/plugin.json` is the plugin version source of
  truth.
- Release tags must be `v<plugin-version>` and match `plugin.json` exactly.
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
git diff --check
```

When Bash is available, confirm hook syntax checks actually ran:

```bash
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

If Bash is not available on Windows, `node scripts/validate-all.mjs` may report
`skipped=1`; do not describe hook syntax as locally passed in that case. CI/Linux
must run the Bash syntax checks.

## Review Before Release

Before tagging, search for:

- Stale `release candidate`, `vNext`, or outdated version wording.
- Command, skill, agent, or pack counts that no longer match repository facts.
- Dead local links or anchors.
- Changelog/date/version drift.
- Generated marketplace, metadata, or catalog drift.
- `.codex/` runtime artifacts.

Use [Registry Author Workflow](../marketplace/registry-author-workflow.md),
[Trust Policy](../marketplace/trust-policy.md), and
[Security Review Route](../marketplace/security-review-route.md) for the
review inputs.

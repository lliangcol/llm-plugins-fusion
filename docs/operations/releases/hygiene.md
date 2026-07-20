<!-- migrated-from: docs/releases/release-hygiene.md -->
# Release Hygiene

Status: active
Date: 2026-05-12

This document defines the release and pre-release checks for marketplace and
plugin changes. Use it with the
[Release evidence template](../../templates/evidence/release.md) and
[Release validation runbook](validation.md) before promoting a
tag or publishing release notes.

## Version And Tag Rules

- `nova-plugin/.claude-plugin/plugin.json` is the development/candidate plugin
  base-version source of truth.
- The root `package.json` repository-tooling version must match the plugin
  manifest version; `node scripts/validate-regression.mjs` enforces this sync.
- `governance/release-channels.json` is the stable version/tag/commit source.
  Stable marketplace outputs and the security support range follow that channel;
  they may legitimately lag unreleased plugin/package metadata.
- Candidate tags use `v<plugin-version>-rc.<number>` while the plugin manifest
  keeps the stable base version. Stable tags use `v<plugin-version>`. Candidate
  and stable tags must be signed, immutable, and point to the same commit.
- Stable promotion targets must be exact release tags backed by a verified
  candidate manifest. A moving `main` branch,
  especially one with `CHANGELOG.md` `Unreleased` content, is an unreleased
  development snapshot rather than stable release material.
- Public SemVer tags are immutable. Never overwrite, delete, reuse, or move an
existing `v*` tag, including with maintainer approval; publish a new patch
version instead.

Candidate evidence bundles include the envelope, promotion intent,
content-addressed control bundle, required promotion evidence, build SBOM,
runtime-capability BOM, and build record. GitHub artifact attestations bind the
plugin archive and the evidence bundle; no standalone provenance file is
claimed. Stable promotion
verifies both signed tags, the original candidate signer workflow attestation,
every required digest and status, and the actual control-bundle archive and
file inventory before publishing those exact candidate bytes. Deterministic
artifact tests build twice and require byte-for-byte equality.
- Release tags must be signed annotated tags created by the designated release
  actor with `git tag -s` and locally checked with `git verify-tag` before push;
  workflows verify them again against `.github/release-signers`.
- A changelog release section is required before publishing a release.
- Unreleased local work may stay under `CHANGELOG.md` `Unreleased` until the
  maintainer decides the release version and date.

## Generated Artifact Rules

- For development/candidate version changes, update the plugin manifest and
  root `package.json` together.
- For a governed stable-channel change, update the exact release-channel and
  registry distribution-source facts, then regenerate stable outputs. Do not
  copy a moving development version into stable registry metadata.
- Regenerate derived files with:

```bash
node scripts/generate-registry.mjs --write
```

- Generated marketplace outputs currently include:
  `.claude-plugin/marketplace.json`,
  `.claude-plugin/marketplace.metadata.json`, and
  `docs/marketplace/catalog.md`.
- Generated surface inventory outputs include:
  `docs/generated/surface-inventory.json` and
  `docs/generated/surface-inventory.md`.
- Do not hand-edit generated outputs to make validation pass.

## Required Checks

For broad release or workflow changes:

```bash
node scripts/generate-registry.mjs --write
node scripts/validate-all.mjs
npm test
node scripts/validate-github-workflows.mjs
node scripts/validate-runtime-smoke.mjs
node scripts/generate-surface-inventory.mjs
node scripts/scan-distribution-risk.mjs
node scripts/validate-regression.mjs
git diff --check
```

Record the exact target, environment, validation results, skipped checks, and
promotion decision with
[Release evidence template](../../templates/evidence/release.md).

When Bash is available, confirm hook syntax checks actually ran:

```bash
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/pre-bash-check.sh
bash -n nova-plugin/hooks/scripts/trusted-node-hook.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

If Bash is not available on Windows, `node scripts/validate-all.mjs` may report
skipped Bash-dependent checks; do not describe hook syntax or runtime smoke as
locally passed in that case. CI/Linux and CI/Windows Bash smoke must run the
Bash syntax and runtime smoke checks.

Run `node scripts/validate-plugin-install.mjs` only in CI or an isolated
test-user environment when mutation flags are used. It may install or update
user-scope Claude plugin state, so unattended local release evidence should record it as pending instead of running it by default. Exact-tag release
workflow publication is blocked by isolated install smoke; PR CI still uses
only the dry-run install preview.

For the full manual sequence, including exact tag creation, isolated install
smoke cleanup, workflow evaluation recording, and final promotion decisions, use
[Release validation runbook](validation.md).

All three privileged workflow entrypoints are `repository_dispatch` events
resolved from protected `main`. The dispatching identity requires
`Contents: write`, tags appear only under `client_payload`, and pushing a tag
does not trigger candidate publication, stable promotion, or recovery. Record
the run URL and exact caller `github.workflow_sha` for each dispatch; stable
promotion also records the reusable job's `job.workflow_sha`. See the [Release
validation runbook](validation.md) for the `gh api` examples.

The release workflow is split by responsibility:

1. `release-candidate` dispatches `.github/workflows/release-candidate.yml` with
   an exact signed RC tag, recomputes the content-addressed exact-profile
   performance manifest, corroborates every retained run and raw report with
   the GitHub Actions API and downloaded artifact, then builds artifacts once,
   performs exact-tag live validation, and publishes a prerelease candidate
   manifest. Repository-only records, self-reported counts or budgets, stale or
   duplicate runs, and mismatched collection identities remain blocked.
2. `promote-release` dispatches `.github/workflows/release.yml` with the exact
   signed stable and candidate tags, then delegates to
   `.github/workflows/promote-release.yml`.
3. `release-recovery-drill` dispatches
   `.github/workflows/release-recovery-drill.yml` with the exact signed
   candidate tag and stable identity, without publication.
4. Promotion downloads the candidate evidence bundle, verifies signed tag, original
   attestation signer, commit, source, artifact, build/runtime BOMs, build
   record, control bundle, and required evidence, then reconciles a draft,
   downloads every asset for exact verification, and exposes only the plugin
   archive, `SHA256SUMS.txt`, and one comprehensive evidence bundle.

Attestation workflow provenance is the protected
`.github/workflows/release-candidate.yml@refs/heads/main` identity plus the
exact `candidate.workflowSourceCommit`. Source identity remains a separate
proof supplied by the signed immutable candidate and stable tags. A generic
attestation check must pass before bundle extraction; the exact source/signer
digest check follows extraction and the bounded candidate-core read.

## Review Before Release

Before tagging, search for:

- Stale `release candidate`, `vNext`, or outdated version wording.
- Whether the target is an exact tag:
  `git describe --tags --exact-match HEAD`.
- Command, skill, agent, or pack counts that no longer match repository facts.
- Dead local links or anchors.
- Changelog/date/version drift.
- Generated marketplace, metadata, catalog, or surface inventory drift.
- GitHub Actions external references that are not pinned to full commit SHAs.
- `.codex/` runtime artifacts.
- Runtime smoke coverage for distributed Bash/Codex helper scripts.
- Distribution risk scan output for active private paths, credentials, JWTs,
  npm tokens, cloud provider keys, private network addresses, internal
  endpoints, private SSH repository URLs, and real `.env` values.
- Regression coverage for registry generation, distribution risk scanning, and
  command/skill/docs drift.
- Plugin install smoke evidence from CI or an isolated test-user environment,
  including the exact-tag release workflow artifact when publishing a tag, never
  from an unattended run that may mutate the operator's user-scope Claude
  plugin installation.
- For minor releases, whether the five primary commands were manually evaluated
  with `docs/tutorials/workflow-evaluation.md` and recorded with
  `docs/templates/evidence/workflow-evaluation.md`, or why that evidence
  is not applicable.

`node scripts/validate-docs.mjs` also checks that `SECURITY.md` declares the
current MINOR support range derived from the stable channel in `governance/release-channels.json`, and that active planning
tables do not keep stale `v1.x` future-version labels. It also checks the core
project positioning, exact-tag promotion wording, and maintainer diagnostic
warning semantics in active release-facing docs. Historical changelog entries
and explicitly archived paths are
intentionally excluded from that stale-planning scan.

Use [Registry Author Workflow](../marketplace/registry-authoring.md),
[Trust Policy](../../reference/security/marketplace-trust.md), and
[Security Review Route](../../reference/security/security-review.md) for the
review inputs.

Independent review, signing-key overlap/rotation, recovery drills, label sync,
and the honest external-adoption evidence boundary are defined in
[Release Operator Recovery And Signing-Key Rotation](recovery-and-key-rotation.md).

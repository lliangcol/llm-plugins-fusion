# Maintainer Release Runbook

Status: active
Date: 2026-07-13

This is the task-oriented entry point for candidate creation, independent
verification, stable promotion, and consumer verification. Detailed gate
semantics remain in [../releases/release-validation-runbook.md](../releases/release-validation-runbook.md),
and recovery/key rotation remains in
[../releases/operator-recovery-and-key-rotation.md](../releases/operator-recovery-and-key-rotation.md).

## 1. Prepare A Clean Candidate

```bash
npm ci --ignore-scripts
npm run validate:release-channels
npm run typecheck
npm run validate:maintainer
npm run test:coverage:check
npm run lint:shell
npm run lint:actions
node scripts/validate-plugin-install.mjs --dry-run
git diff --check
```

ShellCheck and actionlint must actually be installed when their commands are
claimed as passed. Local warnings or unavailable CLIs remain explicit skipped
evidence. Runtime artifacts under `.metrics/` and `.codex/` are not release
content.

## 2. Publish An Exact Candidate

1. Use a signed exact `v<version>-rc.<number>` tag at the reviewed commit.
2. Run `.github/workflows/release-candidate.yml`.
3. Require validation timings, coverage, deterministic archive, build/runtime
   CycloneDX records, checksums, install inventory, route smoke, build record,
   candidate manifest, and control bundle.
4. Require the isolated user-scope install smoke and independent reviewer
   evidence before promotion.

Do not build a candidate from moving `main` and later describe that snapshot as
the stable release.

## 3. Promote The Verified Candidate

Stable publication delegates through `.github/workflows/release.yml` to
`.github/workflows/promote-release.yml`. Promotion must receive explicit stable
and candidate tags, verify the candidate signer workflow and source commit,
reuse candidate bytes, and keep the publish job limited to `contents: write`.

The Release Notes summary should state these facts at the top:

- Stable tag and exact commit.
- Candidate tag used for promotion.
- Compatibility claim and its evidence status.
- Required Node/Bash runtime.
- Known-good assistant versions and latest-canary boundary.

## 4. Verify As A Consumer

Download the release assets, then verify the archive attestation:

```bash
gh release download v4.0.0 --repo lliangcol/llm-plugins-fusion --dir nova-plugin-v4.0.0
gh attestation verify nova-plugin-v4.0.0/nova-plugin-4.0.0.tar.gz --repo lliangcol/llm-plugins-fusion
```

Confirm that `SHA256SUMS.txt` records the archive digest and compare it with a
locally computed digest:

```bash
sha256sum nova-plugin-v4.0.0/nova-plugin-4.0.0.tar.gz
grep 'nova-plugin-4.0.0.tar.gz$' nova-plugin-v4.0.0/SHA256SUMS.txt
```

Inspect `artifact-manifest.json`, `build-sbom.cdx.json`,
`runtime-capabilities.cdx.json`, `inventory.json`, and
`nova-build-record.json`; their presence complements the attestation but does
not by itself prove runtime safety.

## 5. Close The Release

- Confirm `governance/release-channels.json`, plugin metadata, generated
  marketplace outputs, README, SECURITY, CONTRIBUTING, CHANGELOG, and GitHub
  Release Notes describe the same stable version.
- Confirm recent CI, CodeQL, Dependency Review, candidate, promotion, and
  isolated install-smoke results on the resulting ref.
- Record unavailable administrator settings, credentials, or live assistant
  evidence as residual risk rather than silently omitting them.

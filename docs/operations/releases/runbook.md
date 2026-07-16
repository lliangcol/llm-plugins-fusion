<!-- migrated-from: docs/maintainers/release-runbook.md -->
# Maintainer Release Runbook

Status: active
Date: 2026-07-13

This is the task-oriented entry point for candidate creation, independent
verification, stable promotion, and consumer verification. Detailed gate
semantics remain in [../releases/release-validation-runbook.md](validation.md),
and recovery/key rotation remains in
[../releases/operator-recovery-and-key-rotation.md](recovery-and-key-rotation.md).

## 1. Prepare A Clean Candidate

```bash
npm ci --ignore-scripts
npm run validate:release-truth
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

Before creating a candidate tag, the exact hosted-runner performance gate must
also pass:

```bash
node scripts/validate-performance-budget.mjs \
  --check-profile linux-x64-node22-github-hosted-3-fresh-process-full-uncached \
  --sample-manifest governance/evidence/validation-performance-samples.json \
  --verify-github
```

Run it with `GH_TOKEN` or `GITHUB_TOKEN` authorized for `Actions: read`. The
command validates the manifest binding, recomputes the exact profile and
collection identity, rejects duplicate or stale workflow runs, derives the
sample count and P95-plus-headroom budget, and verifies both canonical digests.
It then checks every retained run attempt, job, source ref, artifact API
digest, downloaded ZIP, and raw timing report against GitHub Actions. It
currently fails closed at 0/20 samples; do not create or dispatch a candidate
while that external evidence gate remains blocked. Adding a `sampleCount`
field, a hand-written budget, or 20 repository-only records cannot satisfy it.

## 2. Publish An Exact Candidate

Create and locally verify the signed annotated candidate tag before pushing it:

```bash
CANDIDATE_TAG="v4.1.0-rc.1"
SOURCE_COMMIT="$(git rev-parse HEAD)"
git tag -s -m "nova-plugin ${CANDIDATE_TAG}" \
  "${CANDIDATE_TAG}" "${SOURCE_COMMIT}"
git verify-tag "${CANDIDATE_TAG}"
git push origin "${CANDIDATE_TAG}"
```

Tag pushes do not trigger publication. Dispatch the workflow file from
protected `main`, with the tag only as `client_payload` data:

```bash
gh api --method POST repos/lliangcol/llm-plugins-fusion/dispatches \
  -f event_type=release-candidate \
  -F 'client_payload[candidate_tag]=v4.1.0-rc.1'
```

1. Use the signed exact `v<version>-rc.<number>` tag at the reviewed commit.
2. Dispatch `.github/workflows/release-candidate.yml` through the protected-main
   `repository_dispatch` entrypoint shown above.
3. Require the content-addressed performance sample manifest to contain at
   least 20 current, unique records from the governed workflow identity and a
   budget equal to its recomputed aggregate, then require GitHub Actions API
   and downloaded-artifact corroboration for every record. The repository
   manifest does not prove its own provenance.
4. Require validation timings, coverage, deterministic archive, build/runtime
   CycloneDX records, checksums, install inventory, route smoke, build record,
   candidate manifest, and control bundle.
5. Require the isolated user-scope install smoke and independent reviewer
   evidence before promotion.

Candidate and promotion jobs bootstrap only the protected-main workflow
revision. They do not check out the selected release source until the first
shell step verifies the tag's annotated signature with the signer list read
from protected `origin/main`, binds the tag commit, and proves that commit is an
ancestor of protected `main`. No repository Node/npm/Bash script may run before
that trust step.

The dispatching identity must be authorized to create repository dispatches
with `Contents: write`. Record the resulting run URL and `github.workflow_sha`;
the workflow SHA proves which protected-main workflow revision handled the
request.

Artifact attestation workflow provenance is
`.github/workflows/release-candidate.yml@refs/heads/main` plus the exact
`candidate.workflowSourceCommit`. It proves the protected workflow revision,
not the source checkout. The independently verified signed candidate tag proves
the source commit identity. Promotion and recovery first run a generic
signer-workflow, `refs/heads/main`, and hosted-runner attestation check on the
downloaded archive before extraction. Only after safe extraction may they read
`candidate.workflowSourceCommit` and repeat verification with exact source and
signer digests.

Do not build a candidate from moving `main` and later describe that snapshot as
the stable release.

## 3. Promote The Verified Candidate

Stable publication delegates through `.github/workflows/release.yml` to
`.github/workflows/promote-release.yml`. Promotion must receive explicit stable
and candidate tags, verify the candidate signer workflow and source commit,
reuse candidate bytes, and keep the publish job limited to `contents: write`.

Promotion also fetches the selected candidate through the authenticated GitHub
Releases API. The verifier requires a numeric release id, the exact candidate
tag, a published prerelease state, and the server-owned `published_at`
timestamp. Stable promotion remains blocked until that timestamp is at least
168 hours old. Candidate-manifest `createdAt`, local clocks supplied as evidence,
or backdated files cannot satisfy the observation gate. The normalized
observation record is copied into the digest-bound promotion handoff.

Create and locally verify the stable signed annotated tag, push it, then invoke
the protected-main dispatch. The tag is payload data; pushing it does not start
promotion:

```bash
STABLE_TAG="v4.1.0"
CANDIDATE_TAG="v4.1.0-rc.1"
SOURCE_COMMIT="$(git rev-list -n 1 "${CANDIDATE_TAG}")"
git tag -s -m "nova-plugin ${STABLE_TAG}" \
  "${STABLE_TAG}" "${SOURCE_COMMIT}"
git verify-tag "${STABLE_TAG}"
git push origin "${STABLE_TAG}"
gh api --method POST repos/lliangcol/llm-plugins-fusion/dispatches \
  -f event_type=promote-release \
  -F "client_payload[stable_tag]=${STABLE_TAG}" \
  -F "client_payload[candidate_tag]=${CANDIDATE_TAG}"
```

The Release Notes summary should state these facts at the top:

- Stable tag and exact commit.
- Candidate tag used for promotion.
- Compatibility claim and its evidence status.
- Required Node/Bash runtime.
- Known-good assistant versions and latest-canary boundary.

## 4. Verify As A Consumer

The public download surface contains exactly the plugin archive,
`SHA256SUMS.txt`, and one comprehensive evidence bundle. Download all three,
then verify both attested archives:

```bash
gh release download v4.0.0 --repo lliangcol/llm-plugins-fusion --dir nova-plugin-v4.0.0
gh attestation verify nova-plugin-v4.0.0/nova-plugin-4.0.0.tar.gz --repo lliangcol/llm-plugins-fusion
gh attestation verify nova-plugin-v4.0.0/nova-plugin-4.0.0-evidence-bundle.tar.gz --repo lliangcol/llm-plugins-fusion
```

Confirm that `SHA256SUMS.txt` records both archive digests and compare them with
locally computed digests:

```bash
(cd nova-plugin-v4.0.0 && sha256sum -c SHA256SUMS.txt)
```

The evidence bundle contains `artifact-manifest.json`, `build-sbom.cdx.json`,
`runtime-capabilities.cdx.json`, `inventory.json`, `nova-build-record.json`,
the candidate envelope, review record, and release control bundle. Their
presence complements the attestation but does not by itself prove runtime
safety.

## 5. Exercise Recovery

Recovery reuses the existing signed candidate tag. Its original creation and
local verification use the same signed-tag contract, and operators must verify
it again before dispatching the drill:

```bash
CANDIDATE_TAG="v4.1.0-rc.1"
# Fetch the already-published immutable candidate identity without fetching
# unrelated tags, then repeat the local signature check.
git fetch --no-tags origin \
  "refs/tags/${CANDIDATE_TAG}:refs/tags/${CANDIDATE_TAG}"
git verify-tag "${CANDIDATE_TAG}"
gh api --method POST repos/lliangcol/llm-plugins-fusion/dispatches \
  -f event_type=release-recovery-drill \
  -F 'client_payload[stable_tag]=v4.1.0' \
  -F 'client_payload[candidate_tag]=v4.1.0-rc.1'
```

The non-publishing recovery entrypoint is also `repository_dispatch` on
protected `main`. Use a `Contents: write` dispatch identity and record the run
URL and workflow SHA.

## 6. Close The Release

- Confirm `governance/release-channels.json`, plugin metadata, generated
  marketplace outputs, README, SECURITY, CONTRIBUTING, CHANGELOG, and GitHub
  Release Notes describe the same stable version.
- Confirm recent CI, CodeQL, Dependency Review, candidate, promotion, and
  isolated install-smoke results on the resulting ref.
- Record unavailable administrator settings, credentials, or live assistant
  evidence as residual risk rather than silently omitting them.

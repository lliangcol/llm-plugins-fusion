<!-- migrated-from: docs/releases/operator-recovery-and-key-rotation.md -->
# Release Operator Recovery And Signing-Key Rotation

Status: active

This runbook reduces single-operator release risk without claiming that a
second maintainer or external consumer already exists. Candidate publication is
blocked unless the merged pull request has at least one current approval bound
to its final head commit from a reviewer who is neither the pull-request author
nor the candidate actor.

## Independent Review Gate

`scripts/verify-independent-release-review.mjs` obtains the merged PR and its
review history from GitHub, keeps each reviewer's latest state, requires its
commit to match the final PR head, excludes the PR author and candidate actor,
and writes `independent-review.json`. The candidate
workflow binds that file into the immutable candidate manifest. A dismissed or
superseded approval does not count.

If no independent reviewer is available, release publication remains blocked.
Do not weaken the gate or self-approve; continue development without publishing
until another qualified reviewer participates.

## Signing-Key Rotation

The active SSH public-key allowlist is `.github/release-signers`; operational
metadata is `governance/release-operations.json`.

Operational readiness is intentionally stricter than structural validation:
it requires configured independent reviewers, two usable signers for release
operations, current rotation evidence, a successful non-publishing recovery
drill, and protected-environment evidence before stable promotion. Check it
with `node scripts/validate-release-operational-readiness.mjs --mode promote`.
Missing configuration is a blocker, never an implicit pass.

1. Create a new signing key outside the repository and protect its private key.
2. Add the new public key to `.github/release-signers` while retaining the old
   key for an overlap window.
3. Merge the allowlist change through the independent review gate.
4. Create a disposable signed test tag and verify it with
   `git verify-tag` using the updated allowlist. Do not push or publish it.
5. Use the new key for the next approved RC candidate and complete the recovery
   drill below.
6. Remove the old public key in a separately reviewed PR after overlap evidence
   exists. Never commit private keys or recovery material.

For suspected compromise, remove the public key immediately in a security PR,
revoke or isolate the private key at its storage provider, cancel in-flight
release jobs, and publish only a new immutable patch candidate after review.
Existing tags are never moved or deleted.

## Recovery Drill

Run the manual `Release Recovery Drill` workflow with an immutable signed RC
tag. It performs no publication. The workflow:

1. fetches and verifies the signed annotated candidate tag;
2. downloads the candidate evidence bundle from GitHub Release;
3. verifies the GitHub artifact attestation and signer workflow;
4. rejects unsafe archive paths before extraction;
5. verifies the candidate envelope, promotion intent, control-bundle bytes and
   inventory, commit, source, evidence, build/runtime BOMs, build record, and
   artifact digests with the normal promotion verifier; and
6. uploads the recovered evidence as a drill artifact.

Record the successful run URL and date in
`governance/release-operations.json` under `recovery.lastSuccessfulDrill` in a reviewed PR.
Until such a run exists, recovery automation is implemented but operational
recovery remains **not demonstrated**.

## Label Catalog Recovery

`.github/labels.yml` is the source. `Label Catalog Sync` creates or updates
labels and never deletes unlisted labels. A dry comparison can be run with
`node scripts/sync-github-labels.mjs` when `GITHUB_REPOSITORY` and `GH_TOKEN`
are available; `--apply` is reserved for the scoped workflow.

## External Adoption Evidence

`governance/adoption-evidence.json` intentionally remains
`not-demonstrated` until at least two consented, redacted, digest-bound consumer
records exist. Internal fixtures, local demos, stars, installs, or maintainer
self-reports do not qualify. Each record must include the fields named by that
governance file and must not expose private consumer facts.

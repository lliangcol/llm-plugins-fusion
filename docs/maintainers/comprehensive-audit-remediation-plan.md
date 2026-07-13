# Comprehensive Audit Remediation Plan

Status: local implementation executed; release and live/adoption evidence remain blocked

Date: 2026-07-13

This plan translates the current repository audit into a complete, ordered
remediation program. It covers product positioning, architecture,
implementation, APIs, data models, tests, performance, CI/CD, security,
dependencies, compliance, release operations, and continuing governance.

The plan is deliberately evidence-bound. A green local validation run proves
local engineering readiness only. It does not prove independent review,
protected-environment approval, a recovery drill, live assistant quality,
external adoption, tag publication, or stable installation.

## Baseline And Decision

The repository is locally healthy but the current development head is not
eligible for a new stable publication.

- `nova-plugin` remains the only production plugin and the only current
  marketplace installation unit.
- `v4.0.0` remains the immutable `INSTALL_PROVEN` stable release.
- `main` is newer than `v4.0.0` and is subject to the active correction in
  `governance/release-corrections.json`.
- `governance/release-reviewers.json` remains unconfigured, so the independent
  release-review verifier fails closed.
- Signing-key rotation and recovery automation exist, but neither has current
  operational evidence.
- Current assistant compatibility is declaration-only. Real-task performance
  and external adoption remain explicitly not demonstrated.
- Local validation, coverage, fault injection, dependency audit, remote CI,
  security alerts, signed-tag verification, release asset digests, and GitHub
  attestations were independently rechecked during the audit.

### Required Outcome

The program is complete only when all of the following are true:

1. An active release hold cannot be bypassed by candidate, promotion, recovery,
   or direct release entry points.
2. The correction lifecycle supports an owner-authorized transition without
   creating a circular dependency between candidate evidence and stable
   publication.
3. Trusted reviewer identities, signer redundancy, protected publication, key
   rotation, and recovery evidence satisfy the governed release policy.
4. The preview compiler API cannot accidentally bypass schema and invariant
   validation through a neutrally named entry point.
5. Promotion and stable-install entry points have risk-proportionate coverage,
   mutation, and fault-injection gates.
6. Compatibility, performance, and adoption claims remain bounded until fresh,
   digest-bound external evidence exists.
7. Documentation, generated facts, CI, security, dependency, compliance, and
   release records all agree with the final implementation.

## Scope Boundaries

### In Scope

- Release correction enforcement and lifecycle design.
- Independent reviewer configuration and verification.
- Signer redundancy, key rotation, protected-environment proof, and recovery
  drill evidence.
- Preview package API hardening and migration guidance.
- Targeted test, coverage, mutation, and fault-injection expansion.
- Live assistant, real-task benchmark, compatibility, and adoption evidence.
- CI grouping, readiness reporting, dependency and security verification,
  compliance metadata, documentation, and generated fact synchronization.
- A new immutable candidate-to-stable publication only after all required
  gates are satisfied and publication is separately authorized.

### Out Of Scope

- Moving or deleting any existing `v*` tag.
- Retrofitting new evidence onto `v4.0.0` or treating later `main` history as
  evidence for that release.
- Self-approval, synthetic reviewer identities, fabricated protected-
  environment approvals, or automation-created owner decisions.
- Publishing private consumer facts, raw model transcripts, credentials,
  machine paths, endpoints, or private repository information.
- Activating a public portal, production multi-plugin layout, runtime dynamic
  loading, or broad new workflow surfaces without separate adoption evidence.
- Hand-editing generated marketplace, workflow, adapter, catalog, inventory, or
  fact outputs.

## Confirmed Risk Register

| ID | Severity | Confirmed condition | Required treatment | Closure evidence |
| --- | --- | --- | --- | --- |
| REL-001 | P0 / High | An active release hold exists and stable publication is forbidden | Enforce hold semantics at every release entry point and define a reviewed authorization lifecycle | Negative tests prove every entry point fails closed; exact authorized transition test passes |
| GOV-001 | P0 / High | Trusted users and teams are empty | Owner configures real independent identities; verifier checks final-head approvals | Digest-bound `independent-review.json` from the exact candidate commit |
| OPS-001 | High | One signer, no rotation evidence, no successful recovery drill | Add signer overlap, perform rotation rehearsal and non-publishing recovery drill | Reviewed signer inventory, signed test-tag verification, successful drill URL and evidence digest |
| API-001 | Medium | `compileDirectory()` accepts schema-invalid bundles while `compileValidatedDirectory()` rejects them | Remove or explicitly mark unchecked filesystem APIs and make validated loading the default | Unit and E2E tests reject invalid bundles through every normal package and CLI path |
| TST-001 | Medium | Global coverage passes, but promotion and stable-install wrappers lack critical floors | Add focused CLI/IO tests, critical floors, mutants, and faults | Target module floors pass and every new mutant is killed |
| EVAL-001 | Medium | Current assistant claims are declaration-only; historical live evidence is stale | Run clean-commit, digest-bound known-good and canary evaluations | Generated compatibility registry contains current evidence or remains honestly bounded |
| PERF-001 | Medium | Real-task benchmark has zero live samples | Execute the fixed benchmark only with credentials and budget | Non-zero sample counts, intervals, failure taxonomy, and source digests |
| ADOPT-001 | Medium | External adoption is not demonstrated | Collect at least two consented and redacted records | Governance schema passes with reproducible, digest-bound records |

### Audit Delta: Release Hold Enforcement

The correction is currently schema-validated and projected into the generated
fact graph, but candidate generation, promotion verification, and the release
state machine do not directly consume it. The current empty reviewer policy
still blocks a governed candidate, but reviewer configuration alone must never
turn an advisory hold into an accidental release path. REL-001 therefore comes
before all other release work.

## Thirteen-Dimension Remediation Matrix

| Dimension | Current evidence | Target state | Required work | Acceptance signal |
| --- | --- | --- | --- | --- |
| Product positioning | Single production plugin; portal and multi-plugin lanes deferred; adoption not demonstrated | Public claims remain evidence-derived and do not imply an ecosystem, portal, or proven adoption | Preserve generated product facts; add adoption and compatibility claim guards to documentation validation | README, roadmap, generated facts, compatibility, and adoption records agree |
| Architecture | Pure compiler and IO layers are separate; private preview packages have explicit boundaries | Validated loading is the normal filesystem path; unchecked compilation is explicit and internal | Harden package exports, document prevalidated-object versus filesystem APIs, retain pure `compileProductBundle()` | Invalid filesystem bundles cannot reach normal compilation |
| Implementation | Hook truth, marketplace version truth, path safety, shell broker, and audit logging are aligned | Release corrections are enforced as executable policy, not documentation only | Add a shared correction evaluator and call it from candidate, promotion, orchestrator, and recovery paths | Hold-bypass integration tests fail closed |
| API | CLI has stable JSON output and exit codes; compiler exposes checked and unchecked directory APIs | Neutral API names always validate; unchecked APIs are unmistakable or removed | Deprecate/rename unsafe exports, add stable error codes, update package docs and tests | API snapshot and migration tests pass |
| Data model | Current v5 contract, deterministic v6 projection, behavior IR, and adapters validate | Correction lifecycle and resolution evidence are machine-readable and non-circular | Extend correction schema with explicit lifecycle and evidence fields; regenerate facts | Schema conditionals reject premature or incomplete resolution |
| Tests | 34 unit, 19 integration, 4 E2E files; global and critical gates pass | Release entry points receive direct positive, negative, CLI, mutation, and recovery tests | Add promotion, install, hold, reviewer, rotation, and recovery cases | Full suite, new module floors, mutations, and fault injection pass |
| Performance | Validation timings exist; live task latency, tokens, and cost are unavailable | Deterministic local timings stay observable; live metrics have intervals and failure taxonomy | Preserve timing trend; execute fixed real-task plan only when external gates exist | No unavailable metric is coerced to zero; benchmark report has real `n` values |
| CI/CD | Main CI and CodeQL are green; release workflows use pinned actions and least privilege | PR integrity, release readiness, and publication authorization are distinct gates | Add readiness report/check, hold enforcement, evidence artifacts, and required-check documentation | Green validation cannot be mistaken for publishable status |
| Security | No open CodeQL, Dependabot, or secret-scanning alerts; hooks fail closed | Release policy, signer, archive, attestation, and install controls also fail closed | Add hold-bypass mutants, signer/recovery tests, remote settings readback, and security review | No unreviewed release transition succeeds |
| Dependencies | Locked dependencies; no current npm advisory; plugin archive has no Node runtime dependency | Upgrades remain exact, reviewed, license-compatible, and isolated from plugin distribution | Retain audit, dependency review, package-lock validation, SBOM comparison, and exact assistant package lanes | `npm audit`, dependency review, workspace validation, and SBOM checks pass |
| Compliance | MIT, package license fields, Security Policy, privacy docs, and CycloneDX SBOM exist | Release and evidence records remain traceable, redacted, and license-complete | Validate package/lock/SBOM license alignment and retention boundaries; keep raw private data out | Compliance checklist and distribution scan pass |
| Release | `v4.0.0` is signed, attested, digest-matched, and install-proven; current main is held | A new immutable candidate is independently reviewed, then promoted without byte drift and install-proven | Complete REL-001, GOV-001, OPS-001, candidate verification, protected promotion, and stable proof | Exact-tag ledger ends at `INSTALL_PROVEN`; stable facts match assets and install tree |
| Continuing governance | Active external gate and correction are source-controlled | Every external fact has an owner, cadence, expiry, and evidence reference | Add readiness status, reviewer/signer cadence, drill cadence, compatibility freshness, adoption review, and closure checklist | No null or stale release-critical evidence remains at publication time |

## Work Package 0: Freeze Publication And Establish Baseline

Priority: P0

Estimated effort: 0.5 person-day plus owner acknowledgment

### Changes

1. Record the exact implementation commit, stable tag, stable commit, current
   correction IDs, reviewer-policy digest, signer-list digest, and release-
   operations digest in the work-package evidence.
2. Confirm there is no open release PR, no newly created release tag, and no
   in-progress release workflow before modifying release policy.
3. Keep `v4.0.0` and its GitHub Release immutable.
4. Treat `node scripts/validate-all.mjs` and coverage success as local baseline
   evidence only.

### Acceptance

- Working tree scope is explicit.
- Existing stable tag signature and commit are unchanged.
- The active hold remains in force.
- No user-scope plugin state or remote release state is mutated.

## Work Package 1: Make Release Corrections Executable Policy

Priority: P0

Estimated effort: 2-3 person-days

### Proposed Files

- `scripts/lib/release-corrections.mjs`
- `scripts/validate-release-readiness.mjs`
- `scripts/generate-release-candidate.mjs`
- `scripts/verify-release-promotion.mjs`
- `scripts/release-orchestrator.mjs`
- `.github/workflows/release-candidate.yml`
- `.github/workflows/promote-release.yml`
- `.github/workflows/release-recovery-drill.yml`
- `schemas/release-corrections.schema.json`
- `governance/release-corrections.json`
- `governance/task-registry.json`
- `package.json`
- unit, integration, regression, workflow, and documentation tests

### Policy Model

Implement one shared evaluator that accepts:

- release mode: candidate, promote, recover, or drill;
- stable tag and candidate tag;
- exact source commit;
- correction records;
- independent-review evidence;
- protected-publication requirement;
- install-proof requirement where applicable.

Return a structured result with:

- `status`: `READY`, `BLOCKED_POLICY`, or `BLOCKED_EXTERNAL_GATE`;
- applicable correction IDs and source digest;
- required but missing evidence;
- the maximum permitted release state;
- a stable reason code for CI and release evidence.

### Correction Lifecycle

Replace the ambiguous two-state lifecycle with explicit stages:

1. `active-release-hold`: candidate rehearsal may run, but stable publication
   is prohibited.
2. `authorized-for-new-candidate`: an owner-reviewed decision identifies the
   target version and confirms that a new candidate may be created. It does not
   claim review, publication, or installation proof.
3. `candidate-verified`: exact candidate tag, commit, manifest digest, signer,
   and independent-review evidence are bound. Stable promotion remains subject
   to the protected environment.
4. `resolved-by-governed-release`: exact stable tag, release ledger head,
   published release, stable channel, and install proof are recorded after the
   release succeeds.

The schema must use conditional requirements so that later statuses cannot be
set without the corresponding evidence. A resolution must never be inferred
from a green CI run or from a manually edited status string.

### Enforcement Points

- Candidate preflight: require either no applicable hold or an authorized new-
  candidate decision; bind the correction digest into candidate evidence.
- Candidate generation: include correction IDs and digest in the candidate
  core and promotion intent.
- Promotion verification: reject missing, changed, unresolved, or mismatched
  correction evidence before any publication handoff is built.
- Release orchestrator: limit the highest reachable state according to the
  evaluator result.
- Recovery and drill: verify the same correction and ledger identity; drills
  must never cross `PROMOTION_READY`.
- Stable publication: run only behind the protected `release` environment and
  only from the exact verified handoff.

### Tests

- Active hold blocks promotion even when reviewer configuration is valid.
- Merely changing the status string without required evidence fails schema and
  runtime validation.
- An unrelated correction does not block a different release identity.
- Candidate evidence with one correction digest cannot be promoted after the
  correction file changes.
- Recovery cannot import correction policy from moving `main`.
- Direct orchestration cannot advance beyond the evaluator's permitted state.
- Drill mode remains non-publishing.

### Acceptance

- Every release entry point imports the shared evaluator.
- Release workflows contain an explicit readiness step before side effects.
- `validate-all`, regression tests, workflow validation, and mutation tests
  reject a hold-bypass fixture.
- Readiness output reports the current repository as blocked without causing
  ordinary development CI to be permanently red.

## Work Package 2: Close Independent Review And Operator Resilience

Priority: P0 / High

Estimated effort: 1-2 person-days of repository work plus external reviewer and
owner availability

### Owner-Gated Actions

1. Configure at least one trusted identity for standard changes and enough
   independent identities to satisfy the two-approval sensitive-path policy.
2. Keep PR author, candidate actor, and bot identities excluded as required.
3. Obtain approvals on the exact final head; dismiss or supersede stale
   approvals after any push.
4. Add a second authorized signing key during an overlap window without
   committing private key material.
5. Verify a disposable signed annotated tag locally and do not push it.
6. Run the non-publishing recovery workflow against an immutable signed RC.
7. Record reviewed rotation and recovery evidence in
   `governance/release-operations.json`.

### Repository Changes

- Strengthen `validate-release-operations.mjs` so release readiness, unlike
  structural validation, reports missing reviewer, signer, rotation, drill, or
  protected-environment evidence with stable reason codes.
- Keep ordinary repository validation green when operational evidence is
  honestly absent; expose readiness as a separate result.
- Add expiry/cadence validation for signer inventory review, rotation evidence,
  and recovery drills.
- Verify live GitHub rulesets, default workflow permissions, required checks,
  and protected environment configuration before a release decision.

### Acceptance

- Independent review evidence is bound to the exact candidate commit and final
  PR head.
- The signer allowlist has overlap evidence and at least two usable identities.
- The recovery drill succeeds without publication.
- The protected publication environment requires an external approval.
- No reviewer, signer, or environment fact is inferred from source code alone.

## Work Package 3: Harden Preview Package APIs

Priority: P1

Estimated effort: 1-2 person-days

### Changes

1. Preserve `compileProductBundle(bundle)` as the pure API for callers that
   already possess a validated in-memory bundle.
2. Make validated loading the only normally documented filesystem API.
3. Rename `loadSpecBundle()` and `compileDirectory()` to names containing
   `Unchecked`, or stop exporting them from the package root.
4. If compatibility aliases are temporarily retained, mark them deprecated,
   make the risk explicit, and set a removal milestone.
5. Keep schema-engine injection in `@llm-plugins-fusion/spec` so the compiler
   package does not acquire a hidden Ajv dependency.
6. Preserve stable `SPEC_*` error codes and CLI exit codes.
7. Update framework, migration, compatibility, and second-product docs.

### Tests

- Wrong types, unknown properties, duplicate IDs, missing behaviors, orphan
  behaviors, unknown stages, unsafe adapter paths, and symlink escapes fail
  before compilation.
- The pure in-memory compiler remains deterministic and free of filesystem,
  environment, clock, and process access.
- CLI `validate`, `build`, `test`, `eval`, `inspect`, and `migrate` all use the
  validated boundary.
- API export snapshots prevent accidental reintroduction of a neutral unchecked
  entry point.

### Acceptance

- The invalid-bundle reproduction used by the audit is rejected by every
  documented filesystem API.
- The second-product fixture still compiles without Nova, Claude, or Codex
  constants.
- No runtime dependency enters the distributed `nova-plugin` archive.

## Work Package 4: Strengthen Release-Critical Testing

Priority: P1

Estimated effort: 2 person-days

### Targeted Coverage Floors

Add floors only after tests make them sustainable:

| Module | Lines | Branches | Functions |
| --- | ---: | ---: | ---: |
| `verify-release-promotion.mjs` | 85 | 80 | 90 |
| `verify-stable-install.mjs` | 90 | 80 | 90 |
| `release-corrections.mjs` | 95 | 90 | 100 |
| `validate-release-readiness.mjs` | 90 | 85 | 90 |

Keep the global floors at or above 85% lines, 70% branches, and 90%
functions. Do not use permanent source exclusions or environment overrides as
release evidence.

### New Mutants

- Ignore an active correction.
- Accept a correction digest mismatch.
- Skip candidate-envelope binding.
- Skip control-bundle byte or inventory verification.
- Accept a stable tag that points to a different candidate commit.
- Accept a candidate/install tree digest mismatch.
- Accept an incomplete or expired recovery/rotation record.

### Fault Injection

- Truncated and malformed correction files.
- Concurrent or reordered release ledger events.
- GitHub API pagination, timeout, missing PR, dismissed review, and stale-head
  approval cases.
- Missing, duplicated, renamed, or replaced candidate assets.
- Attestation predicate, signer workflow, source ref, and source digest mismatch.
- Interrupted recovery drill and protected-environment denial.

### Acceptance

- All new mutants are killed by risk-bearing assertions.
- Critical module floors pass on Node.js 22, not only a newer local runtime.
- Linux, Windows, and macOS lanes preserve their documented Bash semantics.
- Coverage metadata lists the complete tracked maintenance source inventory.

## Work Package 5: Produce Live Compatibility And Performance Evidence

Priority: P1 for release claims; P2 for general development

Estimated effort: 2-5 person-days plus assistant credentials and evaluation
budget

### Preconditions

- Clean exact commit with no untracked source changes.
- Current workflow, adapter, runner, dataset, and locked-label digests.
- Exact known-good assistant versions plus non-blocking latest canaries.
- Isolated consumer fixtures and explicit zero-project-write rules.
- Credentials supplied only through approved runtime mechanisms.
- A reviewed budget and retry/rate-limit policy.

### Execution

1. Run the critical live set first and stop on any unauthorized write,
   invented surface, missing-approval failure, or adapter-load failure.
2. Run the complete bilingual and adversarial dataset with the required number
   of attempts.
3. Run the fixed 24-task benchmark across raw, wrapper-full, and
   wrapper-compact conditions for Claude Code and Codex.
4. Preserve derived metrics and redacted failure categories, not raw private
   prompts or credentials.
5. Generate confidence intervals for safety, task success, latency, tokens,
   and cost without coercing unavailable values to zero.
6. Bind evidence records to the exact source, runner, dataset, adapter, and
   assistant versions.

### Claim Rules

- L3/L4 requires current qualifying evidence; runner capability alone is not
  evidence.
- Known-good lanes may block; latest canaries remain drift detectors unless a
  separate policy change is approved.
- Failed or rate-limited runs remain failed or unavailable and are not silently
  omitted.
- Performance claims describe the measured fixture and environment only.

### Acceptance

- Current compatibility records no longer point only to stale evidence, or the
  effective level remains explicitly bounded.
- Benchmark metrics have non-zero sample counts and valid intervals.
- Failure taxonomy and raw-data retention boundary are documented.
- The generated quality report and public documentation match the evidence.

## Work Package 6: Establish External Adoption Evidence

Priority: P2

Estimated effort: external-calendar dependent

### Changes

1. Define a consent record that permits publication of redacted, aggregate
   workflow evidence without exposing consumer identity or private facts.
2. Collect at least two independently maintained consumer records containing
   every field required by `governance/adoption-evidence.json`.
3. Bind each record to a public-safe source digest and validation artifact.
4. Review each record for local paths, endpoints, repository names,
   credentials, business rules, and private knowledge-base content.
5. Change adoption status only after schema and privacy validation pass.

### Acceptance

- At least two consented, redacted, reproducible records exist.
- Internal fixtures, stars, downloads, and maintainer self-reports are not
  counted as external adoption.
- Product positioning changes, if any, are separately reviewed.

## Work Package 7: CI/CD, Security, Dependency, And Compliance Closure

Priority: P1

Estimated effort: 1-2 person-days

### CI/CD

- Add `validate:release-readiness` and `check:release-readiness` as explicit
  tasks with generated task-catalog coverage.
- Keep `validate-all` as integrity validation; do not make ordinary PRs fail
  forever because external release evidence is absent.
- Make release workflows require readiness `READY` before side effects.
- Upload readiness, correction digest, reviewer evidence, signer evidence,
  coverage, timing, SBOM, attestation, and ledger artifacts.
- Retain pinned actions, fixed argv, minimal permissions, and platform lanes.
- Update required-check documentation and regression tests when job names or
  grouping changes.

### Security

- Re-run CodeQL, secret scanning, Dependabot, distribution risk, shell policy,
  hook runtime smoke, archive extraction, and release fault injection.
- Verify live repository rulesets, workflow permissions, and protected
  environment settings.
- Preserve fail-closed behavior when Node, review identity, signer evidence,
  attestation, or required release evidence is unavailable.

### Dependencies

- Install only the locked toolchain with `npm ci --ignore-scripts`.
- Run `npm audit --audit-level=high`, Dependency Review, workspace validation,
  and exact assistant package integrity checks.
- Review every dependency change for license, release notes, Node.js 22 support,
  transitive growth, and impact on the distributed plugin archive.
- Keep optional platform packages and private workspaces out of public runtime
  dependency claims.

### Compliance

- Confirm MIT/SPDX fields across root and workspace manifests.
- Compare package-lock licenses with denied-license policy.
- Verify build and runtime CycloneDX documents, release checksums, and asset
  digests.
- Preserve private vulnerability reporting and local audit-log privacy,
  retention, disable-switch, and redaction documentation.
- Never treat best-effort redaction as permission to publish raw logs.

### Acceptance

- Local and remote security gates have no unresolved high or critical findings.
- Dependency and license checks pass without suppressing relevant findings.
- Generated SBOMs and release assets are mutually consistent.
- CI clearly distinguishes integrity, readiness, and publication states.

## Work Package 8: Documentation And Generated Truth

Priority: P1

Estimated effort: 1 person-day

### Changes

- Update `CLAUDE.md` and `AGENTS.md` only if inventory or non-Claude behavior
  changes.
- Update framework API, release runbook, release hygiene, recovery/rotation,
  security settings, validation index, task catalog, and this plan.
- Add correction lifecycle, readiness reason codes, and external-gate semantics
  to the source-of-truth documentation.
- Regenerate task catalog, fact graph, project state, registry outputs,
  workflow permissions, adapters, runtime contracts, quality report, and
  surface inventory only when their source domains change.
- Correct any active documentation that still states a superseded coverage
  threshold or release status.
- Update `CHANGELOG.md` when behavior, safety boundaries, APIs, versioning, or
  release semantics change.

### Acceptance

- Documentation validation and link checks pass.
- No active document describes held `main` as release-ready.
- No generated file is hand-edited.
- Public docs contain no private consumer or machine facts.

## Work Package 9: Governed Candidate And Stable Release

Priority: blocked until Work Packages 1, 2, 4, 5, 7, and 8 satisfy their
release-relevant exit criteria and an owner separately authorizes publication

Estimated effort: 1 person-day plus external approvals and workflow time

### Candidate

1. Choose the SemVer increment from the actual public behavior and API delta.
2. Update canonical version and release sources; regenerate projections.
3. Merge through current independent review with all required checks green.
4. Create one signed annotated RC tag on the exact reviewed commit.
5. Run candidate preflight, full validation, coverage, artifacts, checksums,
   exact assistant package verification, protected live smoke, isolated install
   smoke, candidate bundle, SBOM attestation, and candidate publication.
6. Stop if any evidence is missing, skipped without an allowed replacement, or
   bound to another commit.

### Stable Promotion

1. Create the signed stable tag on the same commit as the verified candidate.
2. Verify both tag signatures and identical commit identity.
3. Download the original candidate bundle and verify its signer workflow,
   predicate, source ref, and source digest.
4. Verify candidate core, intent, correction evidence, control bundle,
   required evidence, artifact bytes, checksums, and deterministic rebuild.
5. Build a digest-bound handoff and enter the protected release environment.
6. Publish the original verified candidate bytes without rebuilding the release
   payload.
7. Pin stable channel facts to the exact tag and commit.
8. Install from the stable channel in an isolated home and compare the installed
   tree digest with the promoted candidate tree.
9. Advance the ledger to `INSTALL_PROVEN` and then record correction resolution
   on `main` through a reviewed follow-up change.

### Acceptance

- Candidate and stable tags are immutable, signed, and point to one commit.
- GitHub Release assets, checksums, SBOMs, attestations, candidate manifests,
  channel facts, and install proof agree.
- Release ledger continuity is complete and digest-valid.
- Correction status is resolved only after publication and install evidence
  exist.
- A failed publication is recovered forward with a new patch candidate; tags
  are never rewritten.

## Work Package 10: Continuing Governance

Priority: ongoing

### Cadences

| Control | Minimum cadence | Owner evidence |
| --- | --- | --- |
| Reviewer inventory | Before every candidate and after membership changes | Reviewed policy diff and verifier output |
| Signer inventory | Every 90 days and before release | Allowlist review date and active-key proof |
| Key rotation | Every 90 days or on suspected compromise | Overlap, test-tag, retirement, and incident evidence |
| Recovery drill | Every 90 days and after release-control changes | Successful non-publishing workflow run |
| Known-good assistant evidence | Before compatibility upgrade and after relevant source drift | Digest-bound live evidence |
| Latest assistant canary | Scheduled, non-blocking | Drift issue or generated summary |
| Dependency and license review | Every dependency PR and scheduled security run | Dependency Review, npm audit, SBOM comparison |
| Adoption review | Quarterly or when new records arrive | Consented redacted records and privacy review |
| Performance baseline | Before material performance claims and after runner changes | Fixed-plan report with intervals and failure taxonomy |

### Governance Rules

- Every current fact must have one source, owner, review cadence, and evidence
  path.
- `null`, stale, skipped, or declaration-only values remain visible; they are
  never coerced into success.
- Generated facts project source truth but do not replace operational proof.
- Product expansion remains gated by adoption, maintenance ownership, threat
  model, compatibility impact, and rollback strategy.

## Dependency Graph And Execution Order

```text
WP0 Baseline
  -> WP1 Release hold enforcement
       -> WP2 Reviewer and operator resilience
       -> WP4 Release-critical testing
       -> WP7 CI/security/dependency/compliance
  -> WP3 Preview API hardening
       -> WP4 Release-critical testing
  -> WP5 Live compatibility/performance evidence
  -> WP6 Adoption evidence

WP1 + WP2 + WP4 + WP5 + WP7 + WP8
  -> owner publication authorization
  -> WP9 Governed candidate and stable release
  -> WP10 Continuing governance
```

WP3 and WP6 may proceed without publication. WP5 may proceed only when external
credentials and evaluation budget are available. WP9 must not begin merely
because local implementation work is complete.

## Validation Strategy

### Focused During Implementation

```bash
node scripts/validate-schemas.mjs
node scripts/validate-release-operations.mjs
node scripts/validate-release-readiness.mjs
node scripts/validate-github-workflows.mjs
node scripts/generate-fact-graph.mjs
node scripts/generate-task-catalog.mjs
node --test tests/unit/<changed-suite>.test.mjs
node --test tests/integration/<changed-suite>.test.mjs
git diff --check
```

### Full Local Gate

```bash
npm ci --ignore-scripts
npm test
npm run test:coverage:check
npm run test:mutation:critical
npm run test:fault-injection
npm run typecheck
npm run lint:shell
npm run lint:actions
npm audit --audit-level=high
node scripts/validate-plugin-install.mjs --dry-run
node scripts/scan-distribution-risk.mjs
node scripts/validate-all.mjs --write-timings
git diff --check
git diff --cached --check
```

ShellCheck and actionlint count as passed only when the executables actually
run. Bash-dependent checks count as passed only when Bash runs. The plugin
install dry run proves planning and inventory only; it does not prove a real
user-scope installation.

### Remote Gate

- Required Aggregate, Dependency Review, and CodeQL succeed on the exact head.
- Linux Node 22, additional supported Node, Windows Node, Windows Bash, and
  macOS lanes finish with their documented semantics.
- No unresolved CodeQL, Dependabot, secret-scanning, or dependency-review
  finding remains.
- Branch and tag rulesets, default workflow permissions, and protected release
  environment are read back from GitHub.
- Candidate and stable workflows use the exact reviewed commit.

## Rollback And Failure Policy

| Failure | Response |
| --- | --- |
| Hold enforcement blocks ordinary development CI | Separate integrity validation from release readiness; do not weaken the release gate |
| Correction lifecycle is ambiguous or circular | Stop publication work and revise the schema/state model through review |
| Reviewer identities are unavailable | Continue non-release work; do not self-approve or lower thresholds |
| Signer or protected environment is unavailable | Do not create a candidate or stable tag |
| Candidate workflow fails | Fix forward and create a new immutable RC tag |
| Stable publication fails after tag creation | Preserve the tag and recover with a new patch release |
| Live evaluation is rate-limited or unauthenticated | Record unavailable/failed evidence and retain current compatibility level |
| Performance sample is incomplete | Publish no aggregate performance claim |
| Adoption record fails privacy review | Exclude it; do not lower the minimum record count |
| API hardening breaks internal consumers | Use a bounded deprecation alias, document migration, and remove only after repository consumers migrate |

## Final Definition Of Done

The modification program is done only when:

- all confirmed findings have code, test, documentation, and evidence closure;
- release correction policy is enforced at runtime and in workflows;
- independent review and operator evidence are current and non-forgeable;
- preview filesystem APIs validate by default;
- critical release wrappers meet their coverage and mutation floors;
- live and adoption claims either have qualifying evidence or remain explicitly
  unavailable;
- local and remote gates pass on the final exact commit;
- generated outputs are current and the worktree contains no runtime artifacts;
- any release is signed, attested, digest-bound, ledger-complete, stable-pinned,
  and install-proven; and
- this document is updated with actual evidence rather than prospective status.

Until then, the correct status is:

```text
LOCAL_ENGINEERING_READY / RELEASE_BLOCKED / LIVE_AND_ADOPTION_EVIDENCE_PENDING
```

## Execution Record

Execution date: 2026-07-13

No commit, push, PR, tag, GitHub setting change, user-scope installation, or
release publication was performed. The pre-existing `docs/README.md` change
and this plan were preserved and extended.

| WP | Modification target and actual files | Verified facts and checks | Skipped checks, external gates, and residual risk |
| --- | --- | --- | --- |
| WP0 | Freeze the baseline; this plan and `docs/README.md`. | Repository root and branch `main` verified; initial HEAD `ab35580924471b6561a225de6ba6293dbd9fc176`; no open PR or in-progress workflow; initial `validate-all` passed with `failed=0 skipped=0`; active hold and unsafe Preview API reproduced. | Stable tag and remote state were read only. No remote mutation. |
| WP1 | Executable release correction lifecycle in `schemas/release-corrections.schema.json`, `governance/release-corrections.json`, `scripts/lib/release-corrections.mjs`, readiness/candidate/promotion/orchestrator scripts, and release workflows. | Focused schema, correction, candidate, promotion, recovery, and orchestrator tests pass. Active holds produce `BLOCKED_POLICY`, exact identity and correction digests are bound, drills stop at `PROMOTION_READY`, and protected publication is checked before side effects. | Current correction lacks owner authorization, so candidate and stable release remain blocked. |
| WP2 | Independent-review and operator resilience in reviewer/operations governance, schemas, operational-readiness validator, workflows, tests, and operator runbook. | Empty reviewers, one signer, missing rotation, missing drill, and missing protected-environment evidence return stable external-gate reason codes. Configuration absence never passes. | Owner identities, second signer, rotation rehearsal, recovery run, and protected-environment readback require external action. |
| WP3 | Validated Preview API defaults in the spec/compiler/CLI packages; API, framework, migration, and second-product docs; unit and E2E tests. | `loadSpecBundle()` and `compileDirectory()` validate by default; unchecked APIs contain `Unchecked`; `compileValidatedDirectory()` is deprecated until 5.0.0; stable `SPEC_*` and CLI exit semantics remain. | The unchecked escape hatch remains intentionally explicit for prevalidated callers. |
| WP4 | Release-critical coverage, mutation, and fault injection in `governance/critical-coverage.json`, mutation/fault runners, and new suites. | Hold-ignore and identity-bypass mutants are included; readiness/correction suites are included in fault injection; focused suites pass. Final coverage, mutation, and fault commands are recorded below. | Floors may only be accepted if final coverage observes them; no exclusion or threshold override is allowed. |
| WP5 | Compatibility/performance evidence boundaries in existing live runners, fixed 24-task benchmark, generated benchmark report, compatibility registry, and docs. | The local framework reports 432 planned invocations, `n=0`, unavailable intervals, and no aggregate performance conclusion; declaration-only compatibility remains L2/L1. | Claude/Codex credentials and evaluation budget unavailable; live runs not executed. |
| WP6 | Privacy-preserving adoption model in its schema, governance source, validator, facts, and docs. | Consent, redaction, retention, withdrawal, and distinct installation/activation/success/maintenance signals are machine-readable; zero records keeps `not-demonstrated`. | Two consented independent consumer records do not exist and were not fabricated. |
| WP7 | CI/CD, security, dependency, and compliance changes in release/CI workflows, package scripts, schemas, critical gates, and validation docs. | Release readiness is separate from PR integrity; workflows remain pinned, permission-bounded, concurrent, timeout-bounded, and fail closed. Final ShellCheck, actionlint, audit, distribution, and workflow results are recorded below. | Live ruleset, alert, required-check, and protected-environment readback remain external exact-head gates. |
| WP8 | Generated truth and documentation in fact/project-state/task generators, governance sources, docs indexes, runbooks, `CHANGELOG.md`, and generated outputs. | Generated outputs are regenerated from sources and drift checks are part of final validation. Product remains a single-plugin workflow framework; generated facts do not claim operational proof. | No marketplace source changed; marketplace outputs are generator-verified. |
| WP9 | Candidate/stable local preparation through release readiness, dry-run install, deterministic assets, SBOM/checksum/ledger contracts. | All authorized local dry-runs and validators are run below. Current readiness intentionally remains `RELEASE_BLOCKED`. | No owner publication authorization, correction closure, independent approvals, signer redundancy, live evidence, protected approval, immutable new RC, or stable install proof. No tag/release action performed. |
| WP10 | Continuing governance in `governance/evidence-governance.json`, freshness validator/tests, fact graph, task catalog, and this execution record. | Each governed fact has a source, owner role, cadence, expiry, evidence path/status; unavailable facts remain visible as `EVIDENCE_PENDING`. | Periodic evidence collection is ongoing owner work; it cannot be completed from repository code alone. |

### Final Validation Evidence

The final command outcomes are recorded from observed output at the end of the
run. A dry run proves planning and inventory only, not a real install.

| Command | Observed result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed; 15 packages installed and npm reported 0 vulnerabilities. |
| `npm test` | Passed; unit 172/172, integration 87/87, and end-to-end 7/7. |
| `npm run test:coverage:check` | Passed; global lines 88.13%, branches 71.74%, functions 91.24%; 22 critical floors passed; 141/141 maintenance modules loaded. |
| `npm run test:mutation:critical` | Passed; 9/9 critical mutants killed (100%). |
| `npm run test:fault-injection` | Passed; 83/83 tests across 13 critical suites. |
| `npm run typecheck` | Passed. |
| `npm run lint:shell` | Unavailable locally because `shellcheck` is not installed; no pass is claimed. Bash syntax and runtime checks did execute successfully inside `validate-all`. |
| `npm run lint:actions` | Unavailable locally because `actionlint` is not installed; no pass is claimed. The repository workflow contract validator passed. |
| `npm audit --audit-level=high` | Passed; 0 vulnerabilities. |
| `node scripts/validate-plugin-install.mjs --dry-run` | Passed; no Claude command and no user-scope mutation was executed. |
| `node scripts/scan-distribution-risk.mjs` | Passed. |
| `node scripts/validate-all.mjs --write-timings` | Passed; `failed=0 skipped=0`, including executed Bash syntax/runtime checks and generated-fact drift checks. |
| `git diff --check` and `git diff --cached --check` | Passed. |

Remote exact-head checks, live assistant evaluation, qualifying adoption
records, configured independent reviewers, signer rotation/recovery evidence,
protected-environment approval, tags, and publication remain external gates.
The resulting status is therefore:

```text
LOCAL_ENGINEERING_READY / RELEASE_BLOCKED / LIVE_AND_ADOPTION_EVIDENCE_PENDING
```

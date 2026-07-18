<!-- migrated-from: docs/maintainers/deep-research-remediation-and-documentation-redesign-plan.md -->
# Current remediation ledger

Status: source-merged; external gates pending
Date: 2026-07-16
Scope: current repository state and remaining gates only

This ledger replaces accumulated audit transcripts. Completed detail remains in
Git history, issues, and pull requests; this file records current decisions,
verified work, residual risk, and the next executable action.

<!-- generated:project-state:start -->
## Current Machine-Derived Project Facts

Do not edit this block by hand. It is synchronized by
`node scripts/generate-project-state.mjs --write` from repository domain
sources and `governance/product-lanes.json`.

- Plugin: `nova-plugin@4.1.0`; production plugins: 1; public path: `nova-plugin/`
- Runtime: Node.js `>=22`; distributed Bash helpers: `3.2+`
- Inventory: 21 commands, 6 skills, 6 active agents, 8 capability packs
- Workflow contract: schema v5, namespace `nova-plugin`, 21 workflows
- Evaluation datasets: `live-paired` has 168 cases and 2016 planned paired invocations; `real-task-benchmark` has 24 tasks and 432 planned invocations
- Package scripts: `check` is present; `build` is absent
- Active product lanes: `workflow-framework`, `single-plugin-delivery`, `release-candidate-promotion`, `live-assistant-evaluation`, `generic-framework-kernel`
- Planned product lanes: None
- Deferred product lanes: `production-multi-plugin-layout`, `public-portal`, `runtime-dynamic-loading`, `broad-domain-command-expansion`
- Release model: `candidate-and-promotion`
- Active PreToolUse launcher: `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh`, `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-bash-check.sh`
- Active PostToolUse launcher: `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/trusted-node-hook.sh post-write-verify`, `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/trusted-node-hook.sh post-audit-log`
<!-- generated:project-state:end -->

## Positioning and release boundary

`nova-plugin` is the only production plugin. Public portal work and production multi-plugin directory migration remain deferred. They remain separate,
independently named product lanes and are not coupled to an already released version number.

Exact `v4.0.0` is the current stable promotion baseline. Moving `main` may
contain later unreleased maintenance work and must not be promoted as stable
release content. Development metadata and changelog now define the exact
`v4.1.0-rc.1` candidate baseline; no RC or stable tag has been created, and no
stable publication is authorized by this local remediation.

## Completed in source and verified locally

| Work package | Current result | Verification boundary |
| --- | --- | --- |
| Authoring source truth | v5/v1 authoring inputs and governance metadata are documented; generated wrappers, v6/v2 IR, runtime contracts, and generated behavior blocks are not hand-edited. | PR 91 plus docs regression checks |
| Canonical review design | `/nova-plugin:review` is the canonical automatic route; findings-only behavior uses `MODE=findings-only`; `/nova-plugin:review-only` remains direct compatibility only. | ADR, schema, static, simulation, and behavior-golden gates |
| Dataset versioning | Locked v4 labels remain byte-identical; v5 live and critical datasets carry the new semantics. | immutable digest checks and generated profile validation |
| Staged live evaluation | Pilot=12, critical=96, full=2016; critical requires current passing pilot evidence and full requires pilot plus critical evidence. | four pilot slice plans completed; no authenticated model call was made |
| Control plane | npm scripts 80, runnable validation tasks 46, workflows 10, governance sources 18, generators 20. | tightened budgets 80/50/10/18/20 and inventory-backed regression tests |
| Governance bundles | Dependency policy/audit/license data share one bundle; critical coverage/evidence levels/platform/performance share one bundle. | schema, deterministic audit, generated-doc, and workflow checks |
| Workflow consolidation | Dependency audit moved into Nightly; label synchronization moved into PR Governance while preserving required check names and permissions. | GitHub workflow validator |
| User entry surface | README is constrained to 200-250 lines with 90-second installation, real deterministic demo output, one reproducible GIF, five primary entries, and deeper governance links. | documentation and link validation |
| Discovery and contribution | Five GitHub Topics and three bounded good-first issues are live; a consented adoption-record template and Java/Spring capture guide are available. | GitHub repository state and public-safe docs; adoption remains not demonstrated |
| Release review policy | `lliang` is the configured real independent reviewer; standard and sensitive paths prospectively require one non-author, non-actor approval. | repository collaborator role plus fail-closed review verifier; no retroactive approval claim |
| Protected release environment | `release` requires `lliang`, prevents self-review, and accepts deployments only from protected branches. | GitHub environment configuration; no publication approval has been claimed |
| Candidate fail-closed operability | Candidate, stable promotion, and recovery bootstrap only through protected-main `repository_dispatch`; tags are payload identities and never workflow source. Their first shell step verifies signed tags before checking out release source, while candidate core separately binds `candidate.workflowSourceCommit` for attestation provenance. Candidate preflight recomputes the governed GitHub-hosted Node.js 22 performance profile from a schema-valid, content-addressed sample manifest before review, readiness, or archive work, then uses `Actions: read` to corroborate every run attempt, job, source ref, artifact API digest, downloaded ZIP, and raw report. Count and budget are derived; repository JSON cannot self-prove provenance. Every Node/npm release job pins Node.js 22 and source-free jobs cannot enable npm cache. | workflow, ZIP safety, API provenance, and manifest mutation tests pass; the exact-tag candidate remains safely blocked at 0/20 records and would also reject 20 records without external proof |
| Promotion observation | Promotion now derives candidate age from the matching published prerelease returned by the GitHub Releases API and retains normalized observation evidence in the digest-bound handoff. | release schema, 167:59 rejection/168:00 acceptance tests, repository/tag/commit/release-id/time negative tests |
| Contract coherence | Validated loading, v5-to-v6 migration, and runtime compilation share one fail-closed validator for typed input names, order, required/type/enum values, path and approval policies, and compatibility projection. | Contract migration/spec tests and generated runtime/projection freshness checks |
| Bash root binding | Bash policy, session pinning, and PATH containment use the canonical project root; nested event `cwd` is accepted only as an in-root command directory, including realpath/symlink checks. | hook stdin integration tests and runtime validation with no skips |
| Real-task pilot evidence | Three public-safe pilot fixtures, a governed scorer, and a strict submitted-record schema bind HEAD plus dataset, runner, scorer, schema, and fixture digests. Claude, Codex, and MCP raw tool names map to assistant-agnostic canonical actions with normalized event lifecycles; aggregate write counts must exactly match event write effects, and successful implementation requires a completed project-writing event. Partial or complete caller records remain diagnostic, and non-empty input requires a clean repository. | 54-record matrix and negative tests; generated report remains `AWAITING_LIVE_EVIDENCE` at 0/54 with measured and independently verified flags false |
| Adoption and discovery | Consumer scaffolding reads the three canonical templates and emits the profile plus shell policy; adoption evidence v3 requires a reachable source commit plus tracked, globally unique, schema-valid validation and consent evidence that cross-binds the record, signal, source, artifact, and consent semantics; 21 commands map only to the six real canonical Skills. | all-type scaffold regression, schema/semantic negative tests, docs validation, and frontmatter lint |
| Release download surface | Candidate and stable workflows expose exactly the plugin archive, `SHA256SUMS.txt`, and one attested evidence bundle. | workflow validator and digest-bound promotion handoff |

## Validation contract

`validate-docs` checks project positioning contracts, exact-tag release
promotion boundaries, maintainer diagnostic and security setting semantics,
public API compatibility contracts, marketplace trust, author workflow,
compatibility, security review contracts, contribution and issue intake
contracts, docs index navigation contracts, consumer profile privacy contracts,
prompt template privacy contracts, local data handling privacy contracts,
workflow evidence contracts, showcase public-safety contracts, growth metrics
privacy contracts, assets capture privacy contracts, deferred portal IA
contracts, and multi-plugin readiness evidence contracts.

Existing validation covers schema and generated drift, workflow contracts,
behavior fixtures, package and distribution safety, tests, coverage, platform
evidence, GitHub workflow permission, inventory, and required-check contracts.
`validate-github-workflows` checks GitHub workflow token scope, workflow file
inventory, required-check docs and print output.

Current local gate sequence:

~~~bash
npm ci --ignore-scripts
npm run ci:quick
npm test
npm run test:coverage:check
npm run validate:maintainer
git diff --check
~~~

A check is recorded as passed only when it actually ran. Plan mode, dry-run,
skipped Bash checks, and local deterministic simulation never become live
assistant, installation, approval, signing, or adoption evidence.

## Merged source state

- The source-controlled release, contract, hook, evidence, adoption, and Skill
  discoverability remediations were merged into protected `main` by PR #99 at
  commit `9ef14de`. That merge did not create an RC tag, stable tag, release, or
  remote protection/configuration change, so the external gates below remain
  authoritative.
- The final local gate sequence passed on the completed diff: dependency install
  reported zero vulnerabilities; `ci:quick` passed; unit tests passed 309 with
  one platform-conditional skip; integration passed 125/125; end-to-end passed
  13/13; coverage passed at 90.01% lines, 72.22% branches, and 92.66% functions,
  including all 22 critical-module floors and 165/165 maintenance modules.
- Maintainer validation and the default full validator both completed with
  `failed=0 skipped=0`. Generated outputs, registry drift, runtime smoke,
  regression, schemas, docs, workflow contracts, critical mutations, and
  `git diff --check` passed.
- A fresh independent review repeated the generators, full validator, tests,
  coverage, and whitespace checks and reported zero new issues. Generated
  benchmark and project-state projections are synchronized; live benchmark,
  adoption, approval, signing, and publication claims remain explicitly
  unmeasured or externally pending.

## Human or external gates, deliberately last

| Gate | Required evidence | Why autonomous work stops here |
| --- | --- | --- |
| Candidate performance profile | At least 20 current, unique, digest-bound records for `linux-x64-node22-github-hosted-3-fresh-process-full-uncached`; every record must be corroborated by GitHub run/job/artifact state and raw report bytes, and the governed budget must equal recomputed P95 plus 25% headroom rounded to 1,000ms | Real GitHub-hosted timing evidence cannot be fabricated; the bound manifest is at 0/20, its budget is null, and candidate preflight fails closed |
| Code Owner enforcement | Enable `require_code_owner_review` on the active `main-branch-protection` ruleset after reviewing the new two-owner CODEOWNERS mapping | Source mapping is ready, but the live rule is currently false and changing repository protection requires administrator authorization |
| Claude/Codex route pilot | 12 authenticated invocations, all four assistant/condition slices passing, canonical route and required-input recall 3/3, project writes 0 | Requires credentials, budget authorization, and review of real model evidence |
| Real-task pilot | A governed capture/scoring run must independently resolve and recompute retained output, score, tool, and write artifacts for 54 records on one clean source commit | Requires authenticated assistant execution and artifact-verifying runner evidence; caller-supplied records alone remain diagnostic and current coverage is 0/54 |
| Critical and full evals | Pilot evidence before 96 critical calls; pilot plus critical evidence before 2016 full calls | Costly external execution is structurally blocked until prerequisites pass |
| Independent release review | `lliang` approval bound to the integration PR final reviewed head and resulting merge commit | Configuration is complete, but the implementation actor cannot supply the approval |
| Signing overlap and recovery | A second usable authorized key, overlap/rotation evidence, and a successful non-publishing recovery drill | The current allowed signer was locally verified; a second private key decision and immutable RC are still required |
| Protected publication | Approval of the exact candidate/promotion deployment in the configured `release` environment | Environment protection is configured, but approval evidence exists only during a real run |
| Candidate observation | Publish the governed RC only after review, then retain at least 168 hours from the matching GitHub Releases API `published_at` value without a superseding blocker | A real published prerelease and elapsed time cannot be simulated or backdated |
| Adoption | Two consented and redacted external records plus a non-maintainer issue or PR, corroborated by a future independent external provenance verifier before `demonstrated` can be accepted | Users and consent cannot be invented, and repository-local maintainer attestations cannot self-unlock the claim |
| Public Java/Spring recording | Real, redacted Claude Code run reviewed against the capture checklist | The deterministic GIF is contract evidence, not live assistant evidence |

## Dependency and evidence sources

- Dependency governance: `governance/dependency-governance.json`.
- Engineering evidence: `governance/engineering-evidence.json`.
- Validation performance records:
  `governance/evidence/validation-performance-samples.json` (validated by
  `schemas/validation-performance-samples.schema.json`, but accepted only after
  GitHub Actions API and downloaded-artifact verification).
- Evaluation profiles: `governance/evaluation-profiles.json`.
- Release operations and reviewers: `governance/release-operations.json` and
  `governance/release-reviewers.json`.
- Adoption: `governance/adoption-evidence.json`.
- Current generated state: `governance/project-state.generated.json`.

## Exit condition

Local engineering is complete only when all local gates pass on the final diff.
Release and adoption remain explicitly blocked until their real evidence exists:

~~~text
LOCAL_ENGINEERING_READY / CANDIDATE_BLOCKED_PERFORMANCE_EVIDENCE / RELEASE_BLOCKED / LIVE_AND_ADOPTION_EVIDENCE_PENDING
~~~

Historical migration markers retained for governed compatibility:

<!-- merged-from: docs/maintainers/post-remediation-audit.md -->
<!-- merged-from: docs/maintainers/comprehensive-audit-remediation-plan.md -->
<!-- merged-from: docs/project-optimization-plan.md -->
<!-- merged-from: docs/marketplace/v3-readiness-evidence.md -->

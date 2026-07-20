<!-- migrated-from: docs/maintainers/deep-research-remediation-and-documentation-redesign-plan.md -->
# Current remediation ledger

Status: active
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
- Active PreToolUse launcher: `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh`, `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-bash-check.sh`
- Active PostToolUse launcher: `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-write-verify.mjs`, `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-audit-log.mjs`
<!-- generated:project-state:end -->

## Positioning and release boundary

`nova-plugin` is the only production plugin. Public portal work and production multi-plugin directory migration remain deferred. They remain separate,
independently named product lanes and are not coupled to an already released version number.

Exact `v4.0.0` is the current stable promotion baseline. Moving `main` may
contain later unreleased maintenance work and must not be promoted as stable
release content. Development metadata and changelog now define the exact
`v4.1.0-rc.1` candidate baseline; no RC or stable tag has been created, and no
stable publication is authorized by this local remediation.

## Completed locally

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
| Candidate operability | Development version is 4.1.0 and correction authorization selects `v4.1.0-rc.1`; commit self-reference and post-candidate source-rewrite cycles were removed while signed-tag, review-head, envelope, and install bindings remain. | schema v3, release unit/integration tests, candidate operational readiness `READY` |
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

## Autonomous completion state

- All derived outputs are current and the complete local gate sequence above
  passed on 2026-07-16. Coverage passed at lines 89.73%, branches 72.61%, and
  functions 92.34%; all 160 maintenance modules loaded and all 22 per-module
  floors passed.
- The corrected canonical surface inventory was backported to design PR #92.
- No further source-controlled remediation is planned on this branch. The next
  repository action is an integration draft PR and the remaining release
  checklist in issue #54; neither action creates a tag or publishes a release.

## Human or external gates, deliberately last

| Gate | Required evidence | Why autonomous work stops here |
| --- | --- | --- |
| Claude/Codex pilot | 12 authenticated invocations, all four assistant/condition slices passing, canonical route and required-input recall 3/3, project writes 0 | Requires credentials, budget authorization, and review of real model evidence |
| Critical and full evals | Pilot evidence before 96 critical calls; pilot plus critical evidence before 2016 full calls | Costly external execution is structurally blocked until prerequisites pass |
| Independent release review | `lliang` approval bound to the integration PR final reviewed head and resulting merge commit | Configuration is complete, but the implementation actor cannot supply the approval |
| Signing overlap and recovery | A second usable authorized key, overlap/rotation evidence, and a successful non-publishing recovery drill | The current allowed signer was locally verified; a second private key decision and immutable RC are still required |
| Protected publication | Approval of the exact candidate/promotion deployment in the configured `release` environment | Environment protection is configured, but approval evidence exists only during a real run |
| Candidate observation | Publish the governed RC only after review, then observe it for at least seven days without a superseding blocker | Time cannot be simulated or backdated |
| Adoption | Two consented and redacted external records plus a non-maintainer issue or PR | Users and consent cannot be invented |
| Public Java/Spring recording | Real, redacted Claude Code run reviewed against the capture checklist | The deterministic GIF is contract evidence, not live assistant evidence |

## Dependency and evidence sources

- Dependency governance: `governance/dependency-governance.json`.
- Engineering evidence: `governance/engineering-evidence.json`.
- Evaluation profiles: `governance/evaluation-profiles.json`.
- Release operations and reviewers: `governance/release-operations.json` and
  `governance/release-reviewers.json`.
- Adoption: `governance/adoption-evidence.json`.
- Current generated state: `governance/project-state.generated.json`.

## Exit condition

Local engineering is complete only when all local gates pass on the final diff.
Release and adoption remain explicitly blocked until their real evidence exists:

~~~text
LOCAL_ENGINEERING_READY / RELEASE_BLOCKED / LIVE_AND_ADOPTION_EVIDENCE_PENDING
~~~

Historical migration markers retained for governed compatibility:

<!-- merged-from: docs/maintainers/post-remediation-audit.md -->
<!-- merged-from: docs/maintainers/comprehensive-audit-remediation-plan.md -->
<!-- merged-from: docs/project-optimization-plan.md -->
<!-- merged-from: docs/marketplace/v3-readiness-evidence.md -->

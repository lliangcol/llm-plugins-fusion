<!-- migrated-from: docs/maintainers/deep-research-remediation-and-documentation-redesign-plan.md -->
# Current remediation ledger

Status: source-merged; external gates pending
Date: 2026-07-18
Scope: current implemented state and remaining evidence gates

This ledger replaces accumulated audit transcripts. Completed implementation
history remains in commits, pull requests, issues, and `CHANGELOG.md`; this page
keeps only current decisions, source-backed behavior, validation boundaries,
and the next independently executable gates.

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

`nova-plugin` is the only production plugin. Public portal work and production multi-plugin directory migration remain
deferred. They remain separate, independently named product lanes and are not coupled to an already released version number.

Exact `v4.0.0` is the current stable promotion baseline. Moving `main` may
contain later unreleased maintenance work and must not be promoted as stable
release content. Development metadata is `4.1.0`; any candidate and stable
promotion must follow the exact-tag release state machine and produce its own
current evidence.

## Implemented source state

| Review unit | Current implementation |
| --- | --- |
| Workflow ownership | v5/v1 authoring sources and owned product/adapter metadata generate v6/v2 contracts, six canonical Skill behavior blocks, and 21 thin command wrappers. |
| Routing | `/nova-plugin:route` selects one immediate canonical workflow; `/nova-plugin:review` is the automatic canonical review route and findings-only behavior is a mode, not a second canonical Skill. |
| Generic framework | Private spec, compiler, conformance, and CLI workspaces validate product manifests, compile deterministic outputs, run repository profiles, and stage multi-file writes transactionally. |
| Hook trust | Privileged Bash launchers reject startup/preload controls and workspace executable shadows; write targets, policy state, and audit output use physical-path and link checks. |
| Source and artifact trust | Git-backed reads bind repository and executable identity, isolate Git configuration, and use an authored minimal child environment. Clean-commit evidence compares HEAD, the index manifest, physical tracked bytes and portable modes, untracked paths, and hidden index flags. Release and evidence paths use physical single-read boundaries, portable collision checks, deterministic archives, and verified atomic output transactions. |
| Release control | Candidate, promotion, recovery, correction, independent-review, performance-provenance, and install-proof contracts are digest-bound and fail closed when exact evidence is absent. Stable promotion delegates from an already verified candidate rather than rebuilding trust from moving `main`. |
| Evaluation | Static, simulation, behavior-golden, route, live-paired, real-task, compatibility, and public-quality projections distinguish deterministic local evidence from authenticated or external evidence. Missing usage and live results remain unavailable rather than being coerced into success. |
| Documentation | `docs/` and `nova-plugin/docs/` are indexed by current responsibility. Pre-v5 duplicate-looking paths are governed compatibility stubs with explicit retirement metadata, while generated pages remain projections of canonical sources. |
| Distribution | `nova-plugin` is dependency-free at runtime; maintainer tooling uses the lockfile-pinned Node.js 22+ development toolchain. Public distribution scans reject secrets, private paths, unexpected links, oversized text, and Codex runtime artifacts. |

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

The default broad closure is:

```bash
npm ci --ignore-scripts
npm run llmf -- generate all --write
node scripts/validate-all.mjs
npm run test:coverage:check
npm run test:fault-injection
git diff --check
```

A check is passed only when it actually runs. Dry runs, warning-skips,
deterministic simulations, and repository-authored records never become live
assistant, installation, approval, signing, performance, or adoption evidence.

## Audited source baseline

The baseline fetched on 2026-07-18 had local `main` and `origin/main` at
`9a55d70b95c8ff7f644e841775a6e376760bebca` (PR #101). Before the current
maintenance diff, `node scripts/validate-all.mjs` completed with
`failed=0 skipped=0`; `npm run test:coverage:check` passed at 91.91% lines,
76.88% branches, and 96.29% functions, including all 22 critical-module floors
and 183/183 maintenance modules. `npm audit --json` reported zero known
vulnerabilities.

Those numbers identify the reviewed baseline, not permanent future truth. The
final worktree must be regenerated and revalidated after its last edit; a prior
green run is never reused after the review surface changes.

## Remaining external gates

| Gate | Required evidence | Local boundary |
| --- | --- | --- |
| Candidate performance | The governed current GitHub-hosted Node.js 22 profile requires at least 20 unique, digest-bound, API- and artifact-corroborated records and a recomputed budget. | The current manifest is 0/20, so candidate preflight remains blocked. |
| Authenticated assistant evaluation | Current pilot evidence must precede critical and full Claude/Codex runs; retained results and tool effects must be independently recomputed. | Deterministic plans and simulations do not authorize model calls or claim live quality. |
| Independent review | A non-author, trusted, current-head approval must bind the sensitive change set and resulting release identity. | Repository-local implementation cannot manufacture independent approval. |
| Signing and protected publication | Exact candidate/stable tags, authorized signer evidence, protected-environment approval, and immutable release artifacts must agree. | Local validation neither signs nor publishes. |
| Candidate observation and installation | A published prerelease must remain observed for the governed window and pass isolated exact-tag installation proof before promotion. | Time, GitHub release state, and user-scope install proof are external evidence. |
| Adoption | Current, consented, redacted external records require independent provenance before a demonstrated claim is allowed. | Templates and maintainer-authored fixtures are not adoption. |

## Authoritative evidence sources

- Project lanes and generated facts: `governance/product-lanes.json` and
  `governance/project-state.generated.json`.
- Release identity and corrections: `governance/release-channels.json` and
  `governance/release-corrections.json`.
- Release operations and reviewer policy: `governance/release-operations.json`
  and `governance/release-reviewers.json`.
- Engineering and performance evidence: `governance/engineering-evidence.json`
  and `governance/evidence/validation-performance-samples.json`.
- Evaluation and adoption: `governance/evaluation-profiles.json`, `evals/`, and
  `governance/adoption-evidence.json`.
- Current machine-generated repository state:
  `governance/project-state.generated.json`.

## Exit condition

Local engineering is ready only when canonical generation, the full validator,
coverage, focused fault/mutation tests, final diff checks, and fresh rereview all
pass on the same final worktree. Release and adoption remain blocked until
their external evidence exists:

```text
LOCAL_ENGINEERING_READY / CANDIDATE_BLOCKED_PERFORMANCE_EVIDENCE / RELEASE_BLOCKED / LIVE_AND_ADOPTION_EVIDENCE_PENDING
```

Historical migration markers retained for governed compatibility:

<!-- merged-from: docs/maintainers/post-remediation-audit.md -->
<!-- merged-from: docs/maintainers/comprehensive-audit-remediation-plan.md -->
<!-- merged-from: docs/project-optimization-plan.md -->
<!-- merged-from: docs/marketplace/v3-readiness-evidence.md -->

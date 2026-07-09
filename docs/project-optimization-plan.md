# Project Optimization Plan

Status: active
Date: 2026-07-09
Scope: post-`v2.3.0` optimization roadmap for `llm-plugins-fusion`

## Executive Summary

Continue the project as a `nova-plugin` centered AI engineering workflow
framework. Promote released tags, not unreleased `main` snapshots. Keep
`v3.0.0`, public portal work, and production multi-plugin directory migration
deferred until real maintenance pressure appears.

This document is the active optimization record. Tracks 1 through 5 have been
implemented for the `v2.2.0` release-ready work. Track 6 has been resolved by
removing stale archive documentation from the public working tree rather than
keeping a second active archive surface. The 2026-05-12 unattended P0-P2 pass
added maintainer npm shortcuts, consumer profile scaffolding, regression
checks, workflow evaluation fixtures, and expanded distribution-risk scanning.
The exact `v2.3.0` tag and GitHub release now provide the stable promotion
baseline; later `main` commits remain development snapshots until the next
release tag.

Primary optimization sequence:

1. Product positioning and promotion language.
2. First-use command path.
3. Workflow reliability examples and review rubrics.
4. Fact drift validation.
5. Environment and release evidence.
6. Retired archive cleanup and active-agent surface protection.
7. Reliability guardrail hardening.
8. Maintainer diagnostics and workflow check repeatability.

## Deep Research Follow-Up Execution Plan

Status: active follow-up plan
Date: 2026-07-09

This section converts the deep research findings into repository-local work
packages. It does not supersede the completed optimization tracks below. It
tracks both the current follow-up slice and the remaining sequence for
validator maintainability, measurable coverage, portability, no-credential
demos, release proof, and first contribution flow.

### Follow-Up Baseline

Live facts checked for this plan:

- `nova-plugin` remains the only production plugin.
- The public inventory remains 21 commands, 21 one-to-one `nova-*` skills, 6
  active core agents, and 8 documentation capability packs.
- `scripts/validate-docs.mjs` remains the stable CLI entry point. The
  implementation has started moving under `scripts/validate-docs/` so rule
  families can be reviewed without changing the command contract.
- Tests are already split across 3 unit files, 4 integration files, and 3 e2e
  files. The first follow-up slice adds coverage evidence collection; threshold
  decisions remain deferred until CI records a stable baseline.
- `package.json` still declares no `dependencies` or `devDependencies`.
- `validate-all` timing support, workflow fixtures, issue forms, release
  evidence artifacts, Windows Node smoke, Windows Bash smoke, and isolated
  install smoke already exist. Follow-up work should extend these controls, not
  describe them as missing from scratch.
- Hook secret rules are already centralized in `nova-plugin/runtime/secret-rules.mjs`,
  but the active hook entry still runs through Bash.

### Follow-Up Guardrails

- Keep `CLAUDE.md` as the canonical source for repository facts, workflows,
  quality gates, and source-of-truth routing.
- Do not update `AGENTS.md` or `CLAUDE.md` unless inventory, source-of-truth
  rules, or non-Claude execution behavior actually changes.
- Keep public content free of private consumer names, local machine paths,
  endpoints, credentials, repository addresses, runtime flags, business rules,
  and private knowledge-base content.
- Preserve the dependency-free maintainer baseline by default. Any npm
  dependency requires an explicit supply-chain decision and a lower-risk
  no-dependency alternative review.
- Do not commit `.codex/`, `.metrics/`, coverage output, logs, caches, or local
  runtime artifacts unless a file is deliberately promoted as a documented,
  source-controlled fixture.
- Do not hand-edit generated marketplace outputs. Edit source files and run
  `node scripts/generate-registry.mjs --write` when generated outputs must
  change.
- Bash-dependent checks count as locally passed only when Bash actually runs.
  Windows warning-skips must be recorded as skipped, not passed.
- Do not start public portal work, production multi-plugin directory migration,
  runtime dynamic loading, large domain command families, or a custom
  coding-agent runtime as part of this follow-up plan.

### Follow-Up Work Packages

| ID | Priority | Work package | Status | Estimate | Main validation |
| --- | --- | --- | --- | ---: | --- |
| DR0 | P0 | Baseline and execution controls | Complete for the 2026-07-09 slice; repeat for future slices | 0.5-1 day | `npm run validate:maintainer` |
| DR1 | P0 | Modularize `validate-docs` safely | Started; stable wrapper and first rule modules extracted | 5-7 days | docs, regression, tests, maintainer gate |
| DR2 | P0 | Coverage and timing evidence | Implemented for collection; threshold enforcement deferred | 2-3 days | tests, coverage, workflow validation |
| DR3 | P0 | Hook portability and Bash boundary | Started; Node helpers added while Bash remains active | 4-6 days | hooks, runtime smoke, tests, Windows CI |
| DR4 | P1 | Headless public-safe demo harness | Implemented for route, review, and verification fixtures | 3-5 days | workflow fixtures, docs, demos |
| DR5 | P1 | Toolchain and release-proof artifacts | Implemented for `.node-version` and checksums; SBOM/signing deferred | 2-4 days | workflow validation, release dry run |
| DR6 | P1 | First-contribution and issue flow | Started with public-safe first-contribution guidance | 1-2 days | docs validation |
| DR7 | P2 | README information-density pass | Started; continue as positioning-only refinements | 1 day | docs validation |
| DR8 | P0 | Final review and release readiness | Pending final local review and CI evidence | 1-2 days | maintainer gate, CI, release evidence |

### DR0: Baseline And Execution Controls

Objective: establish fresh live-state evidence before any implementation.

Steps:

1. Inspect the branch and worktree.

   ```bash
   git status --short --branch
   ```

2. Scan the live tree before grouping work units.

   ```bash
   rg --files -uu
   ```

   Exclude `.git/`, `.codex/`, dependency directories, build outputs, IDE
   directories, caches, coverage, logs, temporary files, and runtime artifacts.

3. Run a non-mutating baseline gate.

   ```bash
   node scripts/validate-all.mjs --write-timings
   npm run validate:maintainer
   git diff --check
   ```

4. Record skipped checks explicitly. If Bash is unavailable locally, use
   CI/Linux or CI/Windows Bash smoke as replacement evidence before promotion.

Acceptance criteria:

- Baseline command output is recorded in the implementation handoff or PR.
- Initial diffs and runtime artifacts are understood before package work starts.
- Runtime artifacts remain untracked.

### DR1: Modularize `validate-docs` Safely

Objective: reduce validator maintenance concentration without weakening current
documentation contracts.

Primary files:

- `scripts/validate-docs.mjs`
- `scripts/validate-docs/`
- `scripts/validate-regression.mjs`
- `tests/unit/`
- `tests/integration/`
- `docs/maintainers/validation-index.md` when user-facing validation output
  changes

Execution steps:

1. Add or extend regression fixtures before moving logic.
2. Keep `node scripts/validate-docs.mjs` as the stable CLI wrapper.
3. Extract shared utilities first: path filtering, Markdown link/anchor
   parsing, regex expectation helpers, inventory counters, and error/warning
   collection.
4. Move rule families in small reviewable batches:
   - links, anchors, and command docs
   - version, inventory, positioning, and release promotion contracts
   - maintainer, marketplace, contribution, issue intake, and docs index
     contracts
   - consumer, prompt, data handling, workflow evidence, showcase, growth,
     assets, deferred portal, v3 readiness, security range, stale planning, and
     report archive contracts
5. Run focused tests after each extraction batch and the maintainer gate before
   merge.

Acceptance criteria:

- The CLI contract and active docs result remain stable.
- Each extracted rule family has at least one seeded failing fixture or
  regression assertion.
- Troubleshooting guidance remains accurate or is updated in the same package.
- No generated marketplace output changes.

Validation:

```bash
node scripts/validate-docs.mjs
node scripts/validate-regression.mjs
npm test
npm run validate:maintainer
git diff --check
```

Rollback:

- Revert the latest extraction batch only. Keep earlier behavior-preserving
  batches if they already passed review.

Subagent use:

- Use read-only explorer agents for rule-family mapping.
- Use one worker at a time for this package because the validator and tests
  share a tight write surface.

### DR2: Coverage And Timing Evidence

Objective: make test coverage and validation runtime observable while
preserving the no-dependency default.

Primary files:

- `package.json`
- `scripts/`
- `tests/`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `docs/maintainers/validation-index.md`
- `docs/releases/release-validation-runbook.md`
- `docs/releases/release-evidence-template.md`

Execution steps:

1. Verify the minimum supported Node 20 CI lane supports the selected coverage
   approach. Local newer Node behavior is not enough.
2. Prefer Node's built-in test coverage path or a dependency-free normalizer.
   Add npm tooling only after a supply-chain review.
3. Add shortcuts such as `npm run test:coverage` and
   `npm run test:coverage:check`.
4. Start with non-blocking coverage collection if the baseline is unknown.
   Promote thresholds only after CI records a green baseline.
5. Upload coverage and validation timing artifacts from CI or release workflows.
   `validate-all` already supports timing output, so this work should make that
   evidence easier to retrieve rather than invent a second timing system.
6. Document that local coverage and `.metrics/` outputs are runtime artifacts
   and must not be committed unless deliberately promoted as fixtures.

Acceptance criteria:

- Coverage can be collected on the Node 20 CI lane.
- Thresholds, if enabled, are conservative and pass in CI.
- Validation timing evidence is available from CI or release artifacts.
- No npm dependency is added without an explicit decision.

Validation:

```bash
npm test
npm run test:coverage
npm run test:coverage:check
node scripts/validate-github-workflows.mjs
node scripts/validate-docs.mjs
npm run validate:maintainer
git diff --check
```

Rollback:

- Remove blocking thresholds while retaining non-blocking artifact collection.

### DR3: Hook Portability And Bash Boundary

Objective: reduce Windows friction and clarify whether active hooks should rely
on Bash, Node, or both.

Primary files:

- `nova-plugin/hooks/hooks.json`
- `nova-plugin/hooks/scripts/`
- `nova-plugin/runtime/secret-rules.mjs`
- `scripts/validate-hooks.mjs`
- `scripts/validate-runtime-smoke.mjs`
- `tests/unit/`
- `tests/integration/`
- `nova-plugin/docs/architecture/hooks-design.md`
- `docs/marketplace/compatibility-matrix.md`

Decision gate:

- If the active hook command switches from Bash to Node, update compatibility
  docs, hook design docs, validation docs, release notes, and semver assessment
  in the same package.
- If Node cannot be required for hook runtime users, keep Bash as the active
  hook path and treat Node scripts as compatibility helpers until a later
  release decision.

Execution steps:

1. Capture current Bash hook behavior with fixture tests before adding Node
   equivalents.
2. Implement Node hook scripts that read stdin JSON, reuse shared secret rules,
   preserve audit redaction, and return the same block/allow semantics.
3. Keep Bash scripts during transition as wrappers or compatibility smoke
   targets.
4. Update `hooks.json` only after validators, docs, and semver review agree on
   the new active runtime.
5. Extend `validate-hooks` and runtime smoke to validate the active path and any
   retained compatibility path.
6. Ensure Windows Node smoke covers the active hook path. Keep Windows Bash
   smoke while Bash scripts remain distributed.

Acceptance criteria:

- Active hook runtime is explicit in docs and compatibility matrix.
- Secret-like write payloads are still blocked.
- Audit log entries still redact sensitive command or content fragments.
- Bash-dependent checks are not claimed as active-hook evidence if hooks become
  Node-active.

Validation:

```bash
node scripts/validate-hooks.mjs
node scripts/validate-runtime-smoke.mjs
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
npm test
node scripts/validate-docs.mjs
npm run validate:maintainer
git diff --check
```

Rollback:

- Restore `hooks.json` to the Bash command and keep Node scripts non-active
  until behavior parity is repaired or the scripts are removed.

### DR4: Headless Public-Safe Demo Harness

Objective: provide a no-credential demo path that explains the framework
without requiring Claude Code, Codex CLI, marketplace install, network access,
or private consumer context.

Primary files:

- `fixtures/demo/` or `fixtures/workflow/`
- `scripts/demo-*.mjs`
- `scripts/validate-workflow-fixtures.mjs`
- `package.json`
- `docs/getting-started.md`
- `docs/examples/README.md`
- `docs/workflows/source-controlled-checks.md`

Execution steps:

1. Define 2 or 3 public-safe fixtures for route recommendation, plan/review
   signals, and verification evidence.
2. Keep fixture content fictional and generic.
3. Add deterministic demo scripts that print expected route, required inputs,
   output signals, and failure signals. Do not call Claude, Codex, network
   tools, or mutating install paths.
4. Add `npm run demo:*` shortcuts only for deterministic scripts.
5. Extend workflow fixture validation so demos cannot drift from documented
   expected signals.
6. Link the demo path from getting-started and examples docs.

Acceptance criteria:

- A new user can run the demo on a clean Node environment.
- Demo output does not pretend to execute an LLM command.
- Demo fixtures are covered by validation.
- Public-safe boundaries are documented and validated.

Validation:

```bash
npm run demo:route
npm run demo:review
node scripts/validate-workflow-fixtures.mjs
node scripts/validate-docs.mjs
npm run validate:maintainer
git diff --check
```

Rollback:

- Remove npm demo shortcuts and keep the fixtures as examples if the scripts
  become misleading.

### DR5: Toolchain And Release-Proof Artifacts

Objective: improve reproducibility and release trust without adding heavy
release automation or making SBOM/signing a blocker.

Primary files:

- `.node-version` or `mise.toml`
- `docs/maintainers/quickstart.md`
- `docs/maintainers/validation-index.md`
- `.github/workflows/release.yml`
- `.github/workflows/ci.yml`
- `docs/releases/release-validation-runbook.md`
- `docs/releases/release-evidence-template.md`
- `ROADMAP.md` only if deferred release automation decisions change

Execution steps:

1. Choose the smallest toolchain manifest that helps maintainers. Keep
   `package.json` `engines.node` canonical.
2. Add release checksums for selected source-controlled release artifacts:
   `nova-plugin/.claude-plugin/plugin.json`,
   `.claude-plugin/marketplace.json`,
   `.claude-plugin/marketplace.metadata.json`, and
   `docs/marketplace/catalog.md`.
3. Upload checksum artifacts in release workflow. Do not include local runtime
   paths or machine-specific data.
4. Keep SBOM, signing, and automated release notes deferred unless a maintainer
   explicitly promotes them after checksums prove useful.
5. Update release docs so evidence separates exact-tag validation,
   generated-output drift, dry-run plugin install, isolated mutating install
   smoke, checksums, and optional future provenance.

Acceptance criteria:

- Maintainers can see the intended Node baseline before running checks.
- Release workflow publishes checksums for selected release artifacts.
- No new package dependency is added solely to produce checksums.
- Docs do not claim SBOM, signing, or public portal capabilities as current.

Validation:

```bash
node scripts/validate-github-workflows.mjs
node scripts/validate-docs.mjs
npm run validate:maintainer
git diff --check
```

Rollback:

- Remove checksum upload from the release workflow while leaving release
  validation unchanged.

### DR6: First-Contribution And Issue Flow

Objective: make early community contribution easier without implying a mature
community flywheel or public portal.

Primary files:

- `README.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/`
- `.github/pull_request_template.md`
- `docs/maintainers/quickstart.md`

Execution steps:

1. Add a short first-contribution path for docs clarification, fixture updates,
   validator message improvements, and public-safe example improvements.
2. Add a label convention for `good first issue` and `help wanted`. If labels
   are not source-controlled by automation, state that maintainers apply them
   manually.
3. Route questions, feature requests, bug reports, and showcase feedback to
   existing issue forms. Do not document a support forum unless one exists.
4. Keep contribution guidance aligned with generated-output rules and
   public-safe boundaries.

Acceptance criteria:

- A first-time contributor can choose a small task and the right validation
  command.
- Docs do not overstate stars, forks, contributors, portal readiness, or
  ecosystem maturity.
- Issue templates and contribution docs remain consistent.

Validation:

```bash
node scripts/validate-docs.mjs
git diff --check
```

### DR7: README Information-Density Pass

Objective: make the first five minutes clearer while preserving positioning
and exact inventory facts.

Primary files:

- `README.md`
- `nova-plugin/docs/overview/README.en.md`
- `docs/getting-started.md`

Execution steps:

1. Keep the first screen focused on project identity, target users, the
   five-command workflow, and shortest install path.
2. Move advanced details to existing sections or linked docs: agents, packs,
   Codex loop prerequisites, maintainer validation, marketplace metadata, and
   release metadata.
3. Preserve a clear note for non-Claude users: command and skill Markdown can
   be consumed as contracts, but Claude slash-command runtime behavior is not
   assumed outside Claude Code.
4. Keep inventory counts, version references, and public portal boundaries
   consistent with validators.

Acceptance criteria:

- README still passes all positioning and inventory validators.
- New users can find getting-started, five-command path, and non-Claude notes
  quickly.
- No generated files change.

Validation:

```bash
node scripts/validate-docs.mjs
git diff --check
```

### DR8: Final Review And Release Readiness

Objective: close selected work packages with traceable evidence and no hidden
skips.

Steps:

1. Review the complete diff by package, not only as one aggregate patch.
2. Run focused gates for each changed layer.
3. Run the maintainer gate.

   ```bash
   npm run validate:maintainer
   git diff --check
   ```

4. Confirm generated outputs are clean.

   ```bash
   node scripts/generate-registry.mjs
   node scripts/generate-surface-inventory.mjs
   ```

5. Confirm install smoke boundary.

   ```bash
   node scripts/validate-plugin-install.mjs --dry-run
   ```

6. If release-facing, wait for CI evidence for Linux, Windows Node, Windows
   Bash, macOS, CodeQL, dependency review, plugin install smoke, and release
   exact-tag checks as applicable.
7. Record residual risks, including skipped local Bash gates, coverage
   collection mode, inactive Node hook path, or deferred SBOM/signing.

Acceptance criteria:

- No stale report-derived claim contradicts live source.
- All public docs preserve project positioning.
- `.codex/`, `.metrics/`, coverage output, and local artifacts are untracked.
- Final handoff separates verified facts from deferred owner or CI evidence.

### Remaining Follow-Up Sequence

1. Continue DR1 validator modularization in small rule-family batches.
2. Keep DR2 coverage in collection mode until CI records a stable baseline and
   maintainers explicitly choose thresholds.
3. Continue DR3 by deciding whether hooks stay Bash-active or switch to Node;
   do not update `hooks.json` until docs, validators, and semver review agree.
4. Use DR4 demo fixtures as public-safe examples, not as model-output quality
   proof.
5. Use DR5 checksums as lightweight release evidence; keep SBOM, signing, and
   attestations deferred until maintainers explicitly promote them.
6. Continue DR6 and DR7 as positioning-preserving documentation refinements.
7. Run DR8 final review and prepare release or promotion evidence only after CI
   confirms required gates.

Recommended branch names:

- `feature/deep-research-plan`
- `feature/validator-modules`
- `feature/coverage-timing-evidence`
- `feature/hook-portability`
- `feature/headless-demo-harness`
- `feature/release-proof-artifacts`
- `feature/contributor-onboarding`

### Subagent Execution Model

Use subagents only for bounded work with non-overlapping write sets.

Good subagent tasks:

- Read-only rule-family mapping for `validate-docs`.
- Coverage and CI artifact implementation when no other worker edits CI.
- Demo fixture and deterministic script implementation.
- Docs-only contribution-flow rewrite.
- Independent verification of release workflow permissions and artifact paths.

Avoid:

- Multiple workers editing `scripts/validate-docs.mjs` at the same time.
- A worker changing hooks while another changes hook validators without a shared
  interface contract.
- Delegating final integration review.
- Letting subagents commit `.codex/`, `.metrics/`, coverage, logs, or local
  runtime files.

Each subagent handoff should include owned files, explicit non-owned files,
validation commands, expected output artifacts, and residual risk format.

### Open Decisions

| Decision | Default | When to change |
| --- | --- | --- |
| Coverage implementation | Node built-in or dependency-free script | Only add npm tooling after supply-chain review |
| Coverage gate mode | Collect first, enforce later | Enforce immediately only if Node 20 CI baseline is green |
| Active hook runtime | Keep current runtime until compatibility is decided | Switch to Node only with docs, validators, and semver review |
| Release checksums | Add lightweight checksums first | Add SBOM/signing only after explicit maintainer decision |
| Community channels | Existing issues and PRs | Add Discussions only if maintainers commit to monitoring it |
| README rewrite depth | Reorder and compress only | Larger positioning rewrite only with validator updates |

## Current Baseline

- `nova-plugin` is the only production plugin. Multi-plugin behavior is covered
  by registry fixtures, not by production plugin directories.
- Exact `v2.3.0` is the current stable promotion baseline. Moving `main` may
  contain later unreleased maintenance work and must not be promoted as stable
  release content.
- README already presents the main workflow path:
  `/explore` -> `/produce-plan` -> `/review` -> `/implement-plan` ->
  `/finalize-work`.
- Existing validation covers schemas, generated registry output drift, registry
  fixtures, Claude compatibility, command/skill frontmatter, active agents,
  retired active-agent surface guards, packs, pack documentation-only
  enhanced/fallback boundaries, hooks configuration, runtime smoke,
  distribution risk scanning, regression checks for key validation contracts,
  documentation links, version references, current minor support range, stale
  active planning labels, prompt surface budgets, active documentation
  inventory counts, GitHub workflow permission, inventory, and required-check
  contracts, project positioning contracts, exact-tag release promotion
  boundaries, maintainer diagnostic and
  security setting semantics, public API compatibility contracts, marketplace
  trust, author workflow, compatibility, and security review contracts,
  contribution and issue intake contracts, docs index navigation contracts,
  consumer profile privacy contracts, prompt template privacy contracts,
  local data handling privacy contracts, workflow evidence contracts, showcase
  public-safety contracts, growth metrics privacy contracts, assets capture
  privacy contracts, deferred portal IA contracts, and v3 readiness evidence
  contracts.
- On Windows without Bash, `node scripts/validate-all.mjs` may report
  skipped Bash-dependent checks for local hook shell syntax and runtime smoke.
  CI/Linux and CI/Windows Bash smoke must still run the Bash gates before
  release or promotion.

## Optimization Tracks

### 1. Product Positioning And Promotion Language

Status: completed in current unreleased work

Why: Current public language is mostly aligned, but the plugin manifest and
promotion copy can still sound broader than the actual product.

Existing Coverage:

- README states that marketplace is the distribution mechanism and that the
  repository is not a mature multi-plugin ecosystem.
- Roadmap and v3 readiness evidence keep public portal and multi-plugin
  migration deferred.

Completed Work:

- Revised the plugin description to emphasize workflow framework, Claude Code
  compatible commands/skills, consumer profile templates, and validation gates.
- Kept README, generated catalog, marketplace metadata, release notes, and
  promotion copy aligned with one production plugin.
- Added a short "who should use this" and "not ready for" statement to the main
  user-facing overview.

Acceptance Criteria:

- No active document claims a mature multi-plugin ecosystem or public portal.
- Generated marketplace outputs are refreshed after metadata edits.
- `node scripts/validate-schemas.mjs`,
  `node scripts/validate-claude-compat.mjs`, and
  `node scripts/validate-docs.mjs` pass.

### 2. First-Use Command Path

Status: completed in current unreleased work

Why: New users currently see many commands, skills, agents, packs, and Codex
options before they know the default path.

Existing Coverage:

- README already lists the five recommended primary commands.
- Command docs and handbooks already document advanced and compatibility
  commands.

Completed Work:

- Kept the five-command path prominent in README and strengthened it in the
  command handbook.
- Added a compact decision table mapping user intent to command:
  understand, plan, review, implement, finalize.
- Labeled compatibility and Codex commands as advanced paths in onboarding.
- Put Codex CLI and Bash prerequisites next to Codex command examples, not only
  in the compatibility matrix.

Acceptance Criteria:

- A first-time user can choose the correct primary command from README without
  reading agent or pack internals.
- Advanced commands remain available but no longer compete with primary
  onboarding.
- `node scripts/validate-docs.mjs` passes.

### 3. Workflow Reliability Examples And Review Rubrics

Status: completed in current unreleased work

Why: Structural validation proves repository contracts, but it does not prove
that LLM-generated explore, plan, review, implement, and finalize outputs are
useful on realistic tasks.

Existing Coverage:

- Redacted examples and consumer profile templates already define public-safe
  sample material.
- Command and skill contracts already define read/write boundaries.
- Release evidence now points to a concrete workflow evaluation record template
  for manual runs before minor releases.

Completed Work:

- Added a public-safe workflow evaluation set under `docs/examples/`.
- Added `docs/examples/workflow-evaluation-record-template.md` so maintainers
  can record the five-command manual run without relying on exact text
  snapshots.
- Covered the five primary commands with realistic but fictional tasks.
- Defined output rubrics instead of exact text snapshots: facts versus
  assumptions, risk prioritization, honest validation reporting, and read-only
  command boundaries.
- Added a known-limits note stating that contract checks do not prove model
  reasoning quality.

Acceptance Criteria:

- Maintainers can manually run the five-command path against documented
  examples.
- Each example states good output signals and failure signals.
- No private consumer names, paths, endpoints, credentials, or workflow details
  enter public docs.

### 4. Fact Drift Validation

Status: completed in current unreleased work

Why: Counts, versions, release state, and validation rules are repeated across
README, AGENTS, CLAUDE, roadmap, changelog, generated catalog, and command
docs.

Existing Coverage:

- `validate-docs` checks active links, command doc coverage, version
  references, current minor support range, stale active planning labels, active
  documentation inventory counts, project positioning contracts, exact-tag
  release promotion boundaries, maintainer diagnostic and security setting
  semantics, public API compatibility contracts, marketplace trust, author
  workflow, compatibility, and security review contracts, contribution and
  issue intake contracts, docs index navigation contracts, consumer profile
  privacy contracts, prompt template privacy contracts, local data handling
  privacy contracts, workflow evidence contracts, showcase public-safety
  contracts, growth metrics privacy contracts, assets capture privacy
  contracts, deferred portal IA contracts, and v3 readiness evidence contracts.
- `validate-github-workflows` checks GitHub workflow token scope, workflow file
  inventory, required-check docs and print output, forbids `pull_request_target`,
  keeps release write permission scoped to the release job, and keeps mutating
  plugin install smoke isolated from default PR/push checks.
- `validate-schemas` checks generated registry outputs for drift.
- `lint-frontmatter`, `verify-agents`, and `validate-packs` already validate
  several structural counts and pack enhanced/fallback routing boundaries.

Completed Work:

- Added documentation-facing checks for command count, skill count, active agent
  count, and pack count where those facts appear in active docs.
- Added a release precheck for exact tag state:
  `git describe --tags --exact-match HEAD`.
- Kept validation as the primary mechanism over generated Markdown fragments
  until repeated manual edits become a proven maintenance cost.

Acceptance Criteria:

- `node scripts/validate-all.mjs` catches count or version drift before review.
- Release notes distinguish exact release tag content from unreleased `main`
  content.
- Generated outputs continue to be updated only from their source files.

### 5. Environment And Release Evidence

Status: completed in current unreleased work

Why: Local validation can pass with skipped Bash-dependent checks on Windows,
and that status is easy to misreport.

Existing Coverage:

- `validate-all` reports skipped Bash-dependent checks when Bash is unavailable
  on Windows.
- Release hygiene states that skipped local hook syntax and runtime smoke checks
  must not be described as locally passed.
- CI/release workflows run Bash syntax and runtime smoke checks.

Completed Work:

- Added a structured environment summary to `validate-all`.
- Added a release evidence template for validation status and skipped checks.
- Reported Node.js, Claude CLI, Bash, Codex CLI, commit, and tag state in
  validation output; skipped count remains in the validation summary.
- Kept Bash as the authoritative hook syntax runtime; did not add a PowerShell
  substitute unless the hook runtime changes.
- Added Windows CI smoke lanes for schema/docs/frontmatter/PowerShell agent
  verification and for Bash hook/runtime smoke evidence.

Acceptance Criteria:

- Release evidence cannot confuse skipped Bash-dependent checks with a full
  local pass.
- CI/Linux and CI/Windows Bash smoke remain authoritative Bash syntax and
  runtime smoke gates.
- Operators can tell whether they validated an exact tag or unreleased `main`.

### 6. Retired Archive Cleanup

Status: completed in current unreleased work

Why: Retired `.claude` agent files and intermediate archive measurement records
added maintenance noise while active agents are already fixed under
`nova-plugin/agents/`.

Existing Coverage:

- Active agents are fixed under `nova-plugin/agents/`.
- Routing docs point to the current 6-core-agent model and capability packs.
- `AGENTS.md` and `CLAUDE.md` state that retired `.claude/agents/` paths are
  not active agent locations.

Completed Work:

- Removed retired `.claude/agents/` archive documents from the current
  deliverable tree.
- Removed intermediate archive measurement records from `docs/agents/`.
- Updated active indexes so they only describe current routing documents.

Acceptance Criteria:

- Active agent set remains exactly six files under `nova-plugin/agents/`.
- Retired `.claude/agents/` paths are not recreated as active surfaces.
- No active documentation points to removed archive measurement files.

### 7. Reliability Guardrail Hardening

Status: completed in current unreleased work

Maintenance note: [workflows/gsd-informed-hardening.md](workflows/gsd-informed-hardening.md)

Why: Recent workflow reviews identified reliability controls that fit
`nova-plugin`: compact routing, durable checkpoints, prompt-surface budgets,
and explicit release evidence. Nova should adopt those controls while preserving
its marketplace-oriented, low-default-permission model.

Completed Work:

- Strengthened `/route` as the read-only first-stage router.
- Added a checkpoint artifact contract for private consumer workbenches.
- Added `node scripts/validate-surface-budget.mjs` as a prompt bloat guard.
- Added Windows Node/PowerShell and Bash CI smoke evidence.
- Expanded distribution risk scanning for high-risk blanket permission advice
  and tracked `.codex/` runtime artifacts.

Acceptance Criteria:

- The command count remains 21 and command/skill one-to-one mapping remains
  intact.
- No public doc recommends blanket permission bypasses as the default path.
- Surface budget validation is wired into `validate-all`, CI, npm shortcuts,
  and release evidence.

### 8. Maintainer Diagnostics And Workflow Check Repeatability

Status: completed in current unreleased work

Why: The project had strong documentation, but maintainers still needed a
single diagnostic entry, a maintainer-level gate including whitespace checks,
and a repeatable fixture contract for workflow-quality evidence.

Completed Work:

- Added `npm run doctor` for read-only environment, version, tag, working-tree,
  and generated registry diagnostics.
- Added `npm run validate:maintainer` for default validation, generated
  registry drift, and `git diff --check`.
- Added `npm run validate:workflow` for public-safe workflow fixture integrity.
- Added `npm run validate:github-workflows` for least-privilege GitHub Actions
  workflow contracts.
- Made plugin install smoke require explicit user-scope mutation confirmation.
- Documented source-controlled workflow checks as a design boundary instead of
  adding a new runtime prematurely.

Acceptance Criteria:

- Maintainers can diagnose snapshot readiness without mutating repository or
  user plugin state.
- Release evidence distinguishes fixture contract validation from manual
  slash-command quality evaluation.
- Source-controlled check work stays public-safe and script-backed before any
  future `.nova/checks` surface is introduced.

## Execution Order

1. Positioning and promotion language.
2. First-use command path.
3. Workflow reliability examples and review rubrics.
4. Fact drift validation.
5. Environment and release evidence.
6. Retired archive cleanup and active-agent surface protection.
7. Reliability guardrail hardening.
8. Maintainer diagnostics and workflow check repeatability.

Do not start public portal work, production multi-plugin directory migration, or
large domain command families as part of these tracks.

## Release Gate

A release or promotion pass is stable only when all of these are true:

- The promoted target is an exact release tag, not a moving branch.
- Plugin version, registry source, generated marketplace files, generated
  catalog, README badge, changelog, and release date are synchronized.
- `node scripts/validate-all.mjs` passes.
- If local Windows validation reports skipped Bash-dependent checks, CI/Linux
  release validation shows hook shell syntax and runtime smoke checks passed.
- `git diff --check` passes.
- Active docs do not describe deferred `v3.0.0`, public portal, or production
  multi-plugin migration as current capability.
- README still describes one production plugin.

Release level guidance:

- Patch: wording, docs, and validation clarification only.
- Minor: new workflow examples, review rubrics, onboarding artifacts, or catalog
  health summaries.
- Major: command deletion/rename, active agent surface changes, install path
  changes, or real multi-plugin directory migration.

## Validation

For broad changes:

```bash
node scripts/generate-registry.mjs --write
node scripts/validate-all.mjs
node scripts/validate-github-workflows.mjs
node scripts/validate-runtime-smoke.mjs
node scripts/scan-distribution-risk.mjs
node scripts/validate-regression.mjs
node scripts/validate-workflow-fixtures.mjs
git diff --check
```

For documentation-only changes:

```bash
node scripts/validate-docs.mjs
git diff --check
```

When Bash is available:

```bash
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

If Bash is unavailable on Windows and `validate-all` reports skipped
Bash-dependent checks, record that limitation explicitly and rely on CI/Linux
for the hook syntax and runtime smoke gates.

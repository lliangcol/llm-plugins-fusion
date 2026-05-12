# Project Optimization Plan

Status: active
Date: 2026-05-12
Scope: post-`v2.2.0` optimization roadmap for `llm-plugins-fusion`

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
checks, workflow evaluation fixtures, and expanded distribution-risk scanning
without creating tags or releases.

Primary optimization sequence:

1. Product positioning and promotion language.
2. First-use command path.
3. Workflow reliability examples and review rubrics.
4. Fact drift validation.
5. Environment and release evidence.
6. Retired archive cleanup and active-agent surface protection.
7. Reliability guardrail hardening.

## Current Baseline

- `nova-plugin` is the only production plugin. Multi-plugin behavior is covered
  by registry fixtures, not by production plugin directories.
- `v2.2.0` is the current release-ready line. Stable promotion still requires
  an exact `v2.2.0` tag; moving `main` must not be promoted as stable release
  content.
- README already presents the main workflow path:
  `/explore` -> `/produce-plan` -> `/review` -> `/implement-plan` ->
  `/finalize-work`.
- Existing validation covers schemas, generated registry output drift, registry
  fixtures, Claude compatibility, command/skill frontmatter, active agents,
  packs, hooks configuration, runtime smoke, distribution risk scanning,
  regression checks for key validation contracts, documentation links, version
  references, current minor support range, stale active planning labels, prompt
  surface budgets, and active documentation inventory counts.
- On Windows without Bash, `node scripts/validate-all.mjs` may report
  skipped Bash-dependent checks for local hook shell syntax and runtime smoke.
  CI/Linux must still run the Bash gates before release or promotion.

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

- `validate-docs` checks active links, command doc coverage, version references,
  current minor support range, stale active planning labels, and active
  documentation inventory counts.
- `validate-schemas` checks generated registry outputs for drift.
- `lint-frontmatter`, `verify-agents`, and `validate-packs` already validate
  several structural counts.

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
- Added a Windows non-Bash CI smoke lane for schema, docs, frontmatter, and
  PowerShell agent verification evidence.

Acceptance Criteria:

- Release evidence cannot confuse skipped Bash-dependent checks with a full
  local pass.
- CI/Linux remains the authoritative Bash syntax and runtime smoke gate.
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
- Added Windows non-Bash CI smoke evidence.
- Expanded distribution risk scanning for high-risk blanket permission advice
  and tracked `.codex/` runtime artifacts.

Acceptance Criteria:

- The command count remains 21 and command/skill one-to-one mapping remains
  intact.
- No public doc recommends blanket permission bypasses as the default path.
- Surface budget validation is wired into `validate-all`, CI, npm shortcuts,
  and release evidence.

## Execution Order

1. Positioning and promotion language.
2. First-use command path.
3. Workflow reliability examples and review rubrics.
4. Fact drift validation.
5. Environment and release evidence.
6. Retired archive cleanup and active-agent surface protection.
7. Reliability guardrail hardening.

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
node scripts/validate-runtime-smoke.mjs
node scripts/scan-distribution-risk.mjs
node scripts/validate-regression.mjs
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

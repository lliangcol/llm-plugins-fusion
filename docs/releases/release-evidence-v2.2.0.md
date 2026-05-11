# Release Evidence Draft - v2.2.0

Status: draft, do not promote yet
Date: 2026-05-12

This is formal release evidence draft material for `nova-plugin` `2.2.0`.
It is distinct from
[unreleased snapshot evidence](unreleased-snapshot-evidence-2026-05-12.md).
Because the local exact `v2.2.0` tag is absent and manual release steps remain
pending, this document must not be used to describe `2.2.0` as a published
stable release.

## Release Target

```text
Release or promotion target: v2.2.0 release candidate / release-ready line
Commit: pending exact release commit; fill with `git rev-parse HEAD` when final release evidence is collected
Exact tag: none; local v2.2.0 tag not present
Plugin version: 2.2.0
Registry last-updated: 2026-05-12
Operator: Codex unattended P0-P2 pass
Date: 2026-05-12
```

## Environment

```text
Node.js: v24.13.0
Git: git version 2.53.0.windows.1
Claude CLI: 2.1.119 (Claude Code)
Codex CLI: codex-cli 0.130.0-alpha.5
Bash: GNU bash 5.2.21, available
Operating system: Windows host with Bash available for hook syntax and runtime smoke
```

## Validation Results

```text
node scripts/generate-registry.mjs --write: passed; regenerated marketplace.json, marketplace.metadata.json, and docs/marketplace/catalog.md
node scripts/validate-schemas.mjs: passed; generated registry outputs current
node scripts/validate-registry-fixtures.mjs: passed
node scripts/validate-claude-compat.mjs: passed; claude plugin validate passed for marketplace and nova-plugin manifests
node scripts/lint-frontmatter.mjs: passed
node scripts/validate-packs.mjs: passed
node scripts/validate-hooks.mjs: passed
node scripts/validate-runtime-smoke.mjs: passed; Summary: failed=0 skipped=0
node scripts/scan-distribution-risk.mjs: passed; one allowlisted historical warning, output redacted as <redacted>
node scripts/validate-regression.mjs: passed; Summary: failed=0
node scripts/validate-docs.mjs: passed
node scripts/validate-all.mjs: passed; Summary: failed=0 skipped=0; Exact tag: none
npm run validate: passed; delegates to node scripts/validate-all.mjs
npm run validate:regression: passed; delegates to node scripts/validate-regression.mjs
git diff --check: passed
bash -n nova-plugin/hooks/scripts/pre-write-check.sh: passed
bash -n nova-plugin/hooks/scripts/post-audit-log.sh: passed
```

## Blockers And Pending Manual Steps

```text
Exact v2.2.0 tag: blocker / pending manual creation and push after commit
GitHub Release: blocker / pending release workflow or manual release creation
Plugin install smoke: blocker / pending CI or isolated test-user environment
Five-stage workflow evaluation: blocker / fixture prepared at fixtures/workflow/invoice-sync/; pending manual execution of docs/examples/workflow-evaluation-record-2026-05-12.md
Archive context measurement: non-release blocker unless archive movement is proposed; pending measurement and keep archive in place
```

`node scripts/validate-plugin-install.mjs` is intentionally not run by this
unattended pass because it may install or update `nova-plugin` in the user's
Claude Code user-scope plugin state. Run it only in CI or an isolated test user
environment and record the exact result here.

## Skipped Checks

```text
Skipped count: validate-all skipped=0; release evidence has 1 intentionally pending manual/isolated check
Skipped checks: node scripts/validate-plugin-install.mjs intentionally not run in unattended mode
Reason: plugin install smoke can mutate user-scope Claude plugin install state
CI/Linux replacement evidence: required before release promotion
```

If Windows local validation reports skipped Bash-dependent checks because Bash
is unavailable, do not describe hook shell syntax or runtime smoke as locally
passed. Promotion requires CI/Linux evidence that both hook `bash -n` checks and
runtime smoke passed.

## Release Notes Evidence

```text
CHANGELOG section: [2.2.0] release-ready notes exist; exact tag is still pending
Generated marketplace outputs current: yes; generate-registry and validate-schemas passed
README badge/version current: yes; validate-docs passed
Catalog current: yes; validate-schemas passed generated output drift checks
Deferred v3/public portal wording checked: yes; active docs keep v3, public portal, and production multi-plugin migration deferred
```

## Workflow Evaluation Evidence

```text
Manual evaluation source: docs/examples/workflow-evaluation.md
Workflow evaluation record: docs/examples/workflow-evaluation-record-2026-05-12.md
Commands evaluated: fixture prepared; pending manual execution of /explore, /produce-plan, /review, /implement-plan, /finalize-work
Boundary control result: pending
Facts vs assumptions result: pending
Skipped validation reporting result: pending
Next-stage handoff result: pending
Not applicable reason: not applicable; 2.2.0 changes workflow onboarding and evidence, so manual evaluation remains required before promotion
```

## Decision

```text
Promote / do not promote: Do not promote yet / pending manual steps
Reason: exact v2.2.0 tag, plugin install smoke in isolated environment, GitHub Release, and manual workflow evaluation are pending
Known limitations: this draft records release readiness work, not a published stable release
Follow-up: commit any final validated changes, create and push v2.2.0 tag manually, run CI/release workflow, run plugin install smoke in isolation, and complete workflow evaluation
```

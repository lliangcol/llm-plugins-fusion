# Validation Index

Status: active
Date: 2026-07-08

This index maps repository validation surfaces to npm shortcuts and CI checks.
It is the maintainer-facing inventory for validation coverage. Runtime behavior
still lives in the scripts and workflows named below; update this index when a
gate is added, renamed, removed, or moved.

## Boundary

- `scripts/validate-all.mjs` is the default local quality gate.
- `npm run validate:drift` is the focused generated marketplace/catalog drift
  gate.
- `scripts/validate-maintainer.mjs` adds release-maintainer checks such as
  generated registry drift and `git diff --check`.
- `.github/workflows/ci.yml` owns merge-required check names.
- `.github/workflows/plugin-install-smoke.yml` owns isolated mutating install
  smoke evidence and is not a default merge blocker.
- Do not report a skipped local Bash-dependent check as passed. Use CI/Linux or
  CI/Windows Bash evidence when local Bash is unavailable.

## Local Commands

| Command | Purpose | Notes |
| --- | --- | --- |
| `npm run doctor` | Read-only environment preflight. | Warnings can be acceptable for optional CLIs or non-release snapshots. |
| `npm run test` | Node test suite. | Covers unit, integration, e2e, and regression tests. |
| `npm run lint` | Frontmatter and docs validation. | Shortcut for prompt/docs surface checks. |
| `npm run ci:quick` | Fast structural gate. | Schemas, frontmatter, docs, and hooks. |
| `npm run ci:full` | Full default validation. | Alias for `node scripts/validate-all.mjs`. |
| `npm run validate` | Full default validation. | Alias for `node scripts/validate-all.mjs`. |
| `npm run validate:drift` | Generated marketplace/catalog drift gate. | Alias for `node scripts/generate-registry.mjs`. |
| `npm run validate:maintainer` | Maintainer release gate. | Adds generated registry drift and whitespace checks. |
| `npm run validate:github-workflows` | GitHub workflow contract gate. | Run after workflow, required-check, or release CI changes. |
| `npm run validate:runtime` | Bash runtime smoke. | Requires Bash locally. |
| `npm run validate:regression` | Regression tests. | Run after validator, scanner, docs-contract, or scaffold behavior changes. |
| `npm run scan:distribution` | Public distribution risk scan. | Redacts findings and blocks tracked private/Codex runtime artifacts. |

## CI Check Map

| CI check | Source command or workflow | Coverage |
| --- | --- | --- |
| Verify Agents | `bash scripts/verify-agents.sh` | Active agent inventory and retired path checks. |
| Validate Schemas | `node scripts/validate-schemas.mjs` | Plugin, registry, generated metadata, and schema drift. |
| Validate Registry Fixtures | `node scripts/validate-registry-fixtures.mjs` | Registry fixture safety and generated-output fixture shape. |
| Validate Generated Drift | `npm run validate:drift` | Generated marketplace, metadata, and catalog outputs match source. |
| Validate Capability Packs | `node scripts/validate-packs.mjs` | Pack documentation, enhanced/fallback boundaries, and inventory. |
| Validate Claude Compatibility | `node scripts/validate-claude-compat.mjs` | Claude marketplace manifest compatibility. |
| Plugin Install Dry Run | `node scripts/validate-plugin-install.mjs --dry-run` | Safe install-path preview without user-scope mutation. |
| Lint Frontmatter | `node scripts/lint-frontmatter.mjs` | Command and skill frontmatter contracts. |
| Validate Hooks | `node scripts/validate-hooks.mjs` plus hook `bash -n` | Hook config structure and Bash syntax. |
| Validate GitHub Workflows | `node scripts/validate-github-workflows.mjs` | Workflow permissions, inventory, required checks, and smoke boundaries. |
| Validate Runtime Smoke | `node scripts/validate-runtime-smoke.mjs` | Codex loop Bash script syntax, guards, and safe failure paths. |
| Validate Surface Budget | `node scripts/validate-surface-budget.mjs` | Prompt-surface size guardrails and allowlist discipline. |
| Scan Distribution Risk | `node scripts/scan-distribution-risk.mjs` | Public/private boundary and tracked runtime artifact scan. |
| Validate Regression | `node scripts/validate-regression.mjs` | Contract regression suite for validators, docs, scaffold, and scans. |
| Validate Workflow Fixtures | `node scripts/validate-workflow-fixtures.mjs` | Workflow fixture integrity and redaction boundaries. |
| Validate Docs | `node scripts/validate-docs.mjs` | Documentation contracts, links, navigation, and public-safe wording. |
| Windows Node Smoke | `.github/workflows/ci.yml` | Windows schemas, docs, frontmatter, and PowerShell agent verification. |
| Windows Bash Smoke | `.github/workflows/ci.yml` | Windows Bash syntax and runtime smoke evidence. |
| Dependency Review | `.github/workflows/dependency-review.yml` | Dependency graph comparison and dependency-review action. |
| CodeQL / Analyze JavaScript | `.github/workflows/codeql.yml` | Code scanning for JavaScript. |

## Change Routing

| Change type | Minimum focused validation |
| --- | --- |
| Documentation only | `npm run validate:docs`, `git diff --check` |
| Command or skill behavior | `node scripts/lint-frontmatter.mjs`, `node scripts/validate-docs.mjs`, `node scripts/validate-surface-budget.mjs` |
| Hook scripts or config | `node scripts/validate-hooks.mjs`, hook `bash -n`, `node scripts/validate-runtime-smoke.mjs` |
| GitHub workflows | `node scripts/validate-github-workflows.mjs`, `npm run validate:maintainer` |
| Registry or plugin metadata | `node scripts/generate-registry.mjs --write`, `npm run validate:drift`, `node scripts/validate-schemas.mjs`, `node scripts/validate-registry-fixtures.mjs` |
| Release evidence | `npm run validate:maintainer`, install smoke dry-run, and isolated install smoke when promotion evidence requires it |

# Validation Index

Status: active
Date: 2026-07-11

This index maps repository validation surfaces to npm shortcuts and CI checks.
It is the maintainer-facing inventory for validation coverage. Runtime behavior
still lives in the scripts and workflows named below; update this index when a
gate is added, renamed, removed, or moved.

## Boundary

- `scripts/validate-all.mjs` is the default local quality gate.
- `scripts/validate-docs.mjs` is the stable documentation validation CLI; its
  runner and extracted rule modules live under `scripts/validate-docs/`.
- `.node-version` records the intended local Node major for maintainers;
  `package.json` `engines.node` remains the canonical support contract.
- `npm run validate:drift` is the focused generated marketplace/catalog drift
  gate.
- `scripts/validate-maintainer.mjs` adds release-maintainer checks such as
  `npm test`, generated registry drift, and `git diff --check`.
- `scripts/run-test-coverage.mjs` collects dependency-free Node test coverage
  evidence under `.metrics/coverage/`; `--check` enforces the 85% lines, 60%
  branches, and 90% functions baseline and fails unless every Git-tracked,
  non-test maintenance `.mjs` is present in the V8 loaded-source evidence.
- `.github/workflows/ci.yml` owns merge-required check names.
- `.github/workflows/plugin-install-smoke.yml` owns isolated mutating install
  smoke evidence and is not a default merge blocker. It uploads smoke context
  for both passing and failing runs.
- `.github/workflows/release-candidate.yml` uploads candidate validation
  evidence and blocks prerelease publication on isolated install smoke for the
  exact RC tag. `.github/workflows/release.yml` delegates stable promotion to
  `.github/workflows/promote-release.yml`, which reuses the verified candidate
  assets. The candidate bundle also publishes SHA-256 checksums for selected
  source-controlled release artifacts.
- Do not report a skipped local Bash-dependent check as passed. Use CI/Linux or
  CI/Windows Bash evidence when local Bash is unavailable.

## Local Commands

| Command | Purpose | Notes |
| --- | --- | --- |
| `npm run doctor` | Read-only environment preflight. | Warnings can be acceptable for optional CLIs or non-release snapshots. |
| `npm run demo:route` | Headless route demo fixture. | Deterministic public-safe output; does not call Claude Code, Codex, network tools, or install paths. |
| `npm run demo:review` | Headless review and verification demo fixture. | Deterministic public-safe output; does not execute an LLM review or mutate repository state. |
| `npm run test` | Node test suite. | Runs unit, integration, and e2e suites sequentially for clearer CI logs. |
| `npm run test:coverage` | Node built-in coverage collection. | Writes raw V8 coverage and a text summary under `.metrics/coverage/`; no thresholds by default. |
| `npm run test:coverage:check` | Full maintenance coverage and baseline gate. | Fails on test failures, missing coverage output, any unloaded Git-tracked non-test `.mjs`, or coverage below lines 85%, branches 60%, functions 90%; `NOVA_COVERAGE_*` overrides are diagnostic only and do not replace the release baseline. |
| `npm run test:unit` | Unit test suite. | Runs `tests/unit/**/*.test.mjs`. |
| `npm run test:integration` | Integration test suite. | Runs `tests/integration/**/*.test.mjs`. |
| `npm run test:e2e` | E2E smoke suite. | Runs `tests/e2e/**/*.test.mjs`, including the aggregate validation smoke. |
| `npm run lint` | Frontmatter and docs validation. | Shortcut for prompt/docs surface checks. |
| `npm run ci:quick` | Fast structural gate. | Schemas, frontmatter, docs, and hooks. |
| `npm run ci:full` | Full default validation. | Alias for `node scripts/validate-all.mjs`. |
| `npm run validate` | Full default validation. | Alias for `node scripts/validate-all.mjs`. |
| `npm run validate:drift` | Generated marketplace/catalog drift gate. | Alias for `node scripts/generate-registry.mjs`. |
| `npm run validate:maintainer` | Maintainer release gate. | Adds `npm test`, generated registry drift, and whitespace checks. |
| `npm run validate:github-workflows` | GitHub workflow contract gate. | Run after workflow, required-check, or release CI changes. |
| `npm run validate:runtime` | Bash runtime smoke. | Requires Bash locally. |
| `npm run validate:regression` | Regression tests. | Run after validator, scanner, docs-contract, or scaffold behavior changes. |
| `npm run scan:secrets` | Source-owned secret scan gate. | Alias for `node scripts/scan-distribution-risk.mjs`; exposes a named PR check for secret/private-data signals. |
| `npm run scan:distribution` | Public distribution risk scan. | Redacts findings, scans patch/common/unknown text through 10 MiB, fails closed above that limit, and blocks tracked private/Codex runtime artifacts. |

## CI Check Map

| CI check | Source command or workflow | Coverage |
| --- | --- | --- |
| Required / Contracts | `.github/workflows/ci.yml` | Schemas, generated drift, docs/frontmatter, adapters, workflow contracts, inventory, agents, and workflow trust checks in one checkout. |
| Required / Tests | `npm test`, coverage, critical mutation | Unit/integration/e2e, global and critical coverage, and mutation score; uploads `.metrics/coverage/`. |
| Required / Security | hooks, ShellCheck, fault injection, secret/distribution scans | Security guardrails and SARIF evidence in one scoped-permission job. |
| Required / Platform | Linux Node 22/24, Windows Node 22, macOS Node 22 matrix | Cross-platform contracts, Windows PowerShell/Bash, and macOS system Bash. |
| Required / Package | install dry-run and double artifact build | Package inventory, deterministic archive/SBOM/provenance build, and reproducibility. |
| Conditional / Live Evidence | `node scripts/validate-assistant-evidence.mjs` | Runs on `main`; PRs use checked-in digest validation through Contracts. |
| Required / Aggregate | result aggregation | The only CI branch-protection check; fails unless every required consolidated lane succeeds. |
| Release Evidence | `node scripts/generate-release-evidence.mjs` | Machine-readable validation, coverage, install, live route, and checksum aggregation. |
| Validate GitHub Workflows | `node scripts/validate-github-workflows.mjs` | Workflow permissions, inventory, action SHA pinning, required checks, NPM Test gate, and smoke boundaries. |
| Dependency Review | `.github/workflows/dependency-review.yml` | Dependency graph comparison and dependency-review action. |
| CodeQL / Analyze JavaScript | `.github/workflows/codeql.yml` | Code scanning for JavaScript. |

## Change Routing

| Change type | Minimum focused validation |
| --- | --- |
| Documentation only | `npm run validate:docs`, `git diff --check` |
| Command or skill behavior | `node scripts/lint-frontmatter.mjs`, `node scripts/validate-docs.mjs`, `node scripts/validate-surface-budget.mjs` |
| Hook scripts or config | `node scripts/validate-hooks.mjs`, hook `bash -n`, `node scripts/validate-runtime-smoke.mjs` |
| GitHub workflows | `node scripts/validate-github-workflows.mjs`, `npm run validate:maintainer` |
| Test coverage evidence | `npm run test:coverage:check`, `node scripts/validate-github-workflows.mjs` when CI upload wiring changes |
| Registry or plugin metadata | `node scripts/generate-registry.mjs --write`, `npm run validate:drift`, `node scripts/validate-schemas.mjs`, `node scripts/validate-registry-fixtures.mjs` |
| Release evidence | `npm run validate:maintainer`, `node scripts/generate-release-checksums.mjs`, install smoke dry-run, and isolated install smoke when promotion evidence requires it |
| Public surface inventory | `node scripts/generate-surface-inventory.mjs --write`, `node scripts/generate-surface-inventory.mjs`, `npm test` |

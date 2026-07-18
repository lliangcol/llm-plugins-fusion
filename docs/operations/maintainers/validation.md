<!-- migrated-from: docs/maintainers/validation-index.md -->
# Validation Index

Status: active
Date: 2026-07-18

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
  evidence under `.metrics/coverage/`; `--check` enforces the 85% lines, 70%
  branches, and 90% functions baseline and fails unless every Git-tracked,
  non-test maintenance `.mjs` is present in the V8 loaded-source evidence.
- `.github/workflows/ci.yml` owns merge-required check names.
- `.github/workflows/plugin-install-smoke.yml` owns isolated mutating install
  smoke evidence and is not a default merge blocker. It uploads smoke context
  for both passing and failing runs.
- `.github/workflows/release-candidate.yml` uploads candidate validation
  evidence and blocks prerelease publication on isolated install smoke for the
  exact RC tag. It also requires the exact governed Linux/Node 22 GitHub-hosted
  performance profile; until 20 comparable samples establish that profile,
  candidate performance remains Blocked rather than silently non-comparable.
  `.github/workflows/release.yml` delegates stable promotion to
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
| `npm run test:coverage:check` | Full maintenance coverage and baseline gate. | Fails on test failures, missing coverage output, any unloaded Git-tracked non-test `.mjs`, or coverage below lines 85%, branches 70%, functions 90%; `NOVA_COVERAGE_*` overrides are diagnostic only and do not replace the release baseline. |
| `npm run test:unit` | Unit test suite. | Runs `tests/unit/**/*.test.mjs`. |
| `npm run test:integration` | Integration test suite. | Runs `tests/integration/**/*.test.mjs`. |
| `npm run test:e2e` | E2E smoke suite. | Runs `tests/e2e/**/*.test.mjs`, including the aggregate validation smoke. |
| `npm run lint` | Frontmatter and docs validation. | Shortcut for prompt/docs surface checks. |
| `npm run ci:quick` | Fast structural gate. | Schemas, frontmatter, docs, and hooks. |
| `npm run ci:full` | Full default validation. | Alias for `node scripts/validate-all.mjs`. |
| `npm run validate` | Full default validation. | Alias for `node scripts/validate-all.mjs`. |
| `npm run llmf -- check quick` | Fast repository check profile. | Fixed-argv equivalent of the structural quick gate; unknown profiles fail closed. |
| `npm run llmf -- check full` | Full repository check profile. | Runs `node scripts/validate-all.mjs` without shell composition. |
| `npm run llmf -- check security` | Security repository check profile. | Runs typecheck, ShellCheck, actionlint, workflow validation, and the distribution-risk scan in order. |
| `npm run llmf -- check release` | Release repository check profile. | Runs coverage, evidence-only maintainer validation, and install dry-run in order. |
| `npm run llmf -- generate docs\|runtime\|release\|all` | Generated projection drift profiles. | Read-only by default; append `--write` explicitly to update every output in the selected profile. |
| `npm run validate:drift` | Generated marketplace/catalog drift gate. | Alias for `node scripts/generate-registry.mjs`. |
| `npm run validate:maintainer` | Maintainer release gate. | Adds `npm test`, generated registry drift, and whitespace checks. |
| `npm run validate:github-workflows` | GitHub workflow contract gate. | Run after workflow, required-check, or release CI changes. |
| `npm run validate:runtime` | Bash runtime smoke. | Requires Bash locally. |
| `npm run validate:regression` | Regression tests. | Run after validator, scanner, docs-contract, or scaffold behavior changes. |
| `npm run scan:secrets` | Source-owned secret scan gate. | Alias for `node scripts/scan-distribution-risk.mjs`; exposes a named PR check for secret/private-data signals. |
| `npm run scan:distribution` | Public distribution risk scan. | Redacts findings, scans patch/common/unknown text through 10 MiB, fails closed above that limit, and blocks tracked private/Codex runtime artifacts. |

## Maintainer Entrypoint Families

The recommended root shortcuts are intentionally limited to these task families.
Focused implementation scripts remain callable directly when a narrower gate is
needed, but they do not all need a second name in `package.json`.

| Family | Recommended entrypoints |
| --- | --- |
| Doctor/demo | `doctor`, `validate:bootstrap`, `demo:all`, `demo:route`, `demo:review` |
| Test/coverage | `test`, `test:unit`, `test:integration`, `test:e2e`, `test:coverage`, `test:coverage:check` |
| Validate/check | `llmf check quick\|full`, `validate`, `ci:quick`, `ci:full`, `check`, `validate:maintainer`, plus focused `validate:*` gates that carry distinct policy or arguments |
| Security | `llmf check security`, `scan:secrets`, `scan:distribution` |
| Release | `llmf check release`, `check:release-readiness`, `release:*`, `validate:release-truth`, `validate:release-readiness` |
| Generation | `llmf generate docs\|runtime\|release\|all [--write]`, `sync:project-state`, `normalize:surfaces`, `migrate:docs` |

### Control-plane entrypoint migration

The phase-one review traced each root shortcut through package-to-package calls,
the runnable validation registry, all workflow YAML, maintainer documentation,
and shell/PowerShell/Node command strings. The following names were the only
safe removals. A removed name is listed without runnable `npm run` syntax so
documentation cannot accidentally reintroduce it as an active command.
Here, "generated inventories" means both the generated maintainer task catalog
and the generated control-plane inventory; neither is an execution caller.

| Removed name | Classification | Repository references before removal | Replacement | Compatibility impact |
| --- | --- | --- | --- | --- |
| `eval:dataset-integrity` | exact duplicate | evaluation README and generated inventories | `eval:route` | Repository docs migrated; the underlying route-conformance task is unchanged. |
| `check:contracts` | exact duplicate | generated inventories only | `validate` | Removes a repository-maintainer alias; the full validation command is unchanged. |
| `check:tests` | unreferenced wrapper | generated inventories only | `test` | Removes a parameter-free forwarding alias. |
| `check:coverage` | unreferenced wrapper | generated inventories only | `test:coverage:check` | Removes a parameter-free forwarding alias. |
| `validate:release-channels` | exact duplicate | release runbook and generated inventories | `validate:release-truth` | Release runbook migrated; release fact validation is unchanged. |
| `validate:evaluation-profiles` | generator/write variant | generated inventories only | `node scripts/generate-quality-report.mjs` | Evaluation plans and the public quality report now share one lifecycle owner. |
| `validate:release-summary` | generator/write variant | generated inventories only | `node scripts/generate-release-summary.mjs` | Read-only drift check remains available directly; the write entrypoint remains distinct. |
| `validate:tasks` | generator/write variant | generated inventories only | `node scripts/generate-task-catalog.mjs` | Read-only catalog validation remains in the runnable registry. |
| `validate:control-plane` | generator/write variant | generated inventories only | `node scripts/validate-control-plane-complexity.mjs` | Inventory drift and complexity limits now share one lifecycle owner. |
| `validate:evidence-levels` | generator/write variant | generated inventories only | `node scripts/generate-release-summary.mjs` | Evidence taxonomy and the release summary now share one lifecycle owner. |
| `validate:permissions` | generator/write variant | generated inventories only | `node scripts/generate-workflow-permissions.mjs` | CI and the runnable registry continue to call the same read-only generator. |
| `validate:command-docs` | generator/write variant | generated inventories only | `node scripts/generate-command-docs.mjs` | Read-only drift check remains in the runnable registry; the write entrypoint remains distinct. |
| `validate:doc-governance` | generator/write variant | generated inventories only | `node scripts/generate-doc-governance.mjs` | Read-only drift check remains in the runnable registry; the write entrypoint remains distinct. |
| `validate:doc-migrations` | generator/write variant | generated inventories only | `node scripts/migrate-documentation-layout.mjs` | Read-only migration validation remains in the runnable registry; the write entrypoint remains distinct. |

Retained compatibility and security mappings deliberately share one
implementation rather than duplicating logic:

| Retained name | Canonical implementation | Why it remains |
| --- | --- | --- |
| `ci:full` | `node scripts/validate-all.mjs` (same implementation as `validate`) | Widely documented compatibility name for existing maintainer automation. |
| `scan:secrets` | `node scripts/scan-distribution-risk.mjs` | Required security entrypoint and named secret/private-data contract. |
| `scan:distribution` | `node scripts/scan-distribution-risk.mjs` | Required distribution gate and SARIF/public-archive contract. |

Phase two removed 20 additional forwarding aliases after tracing repository
callers and preserving their fixed task sequences in the private `llmf` CLI:

| Removed names | Replacement | Compatibility and safety boundary |
| --- | --- | --- |
| `check:truth`, `check:runtime`, `check:compatibility` | `npm run llmf -- check full` or the focused direct validator | Full validation is a deterministic superset; distinct focused validators remain callable directly. |
| `check:docs` | `npm run llmf -- check quick` plus a focused community gate when needed | The quick profile retains schema, frontmatter, docs, and hook checks; community validation remains a distinct direct task. |
| `check:security` | `npm run llmf -- check security` | Preserves typecheck, ShellCheck, actionlint, GitHub workflow validation, and the distribution-risk scan in fixed order. |
| `check:release` | `npm run llmf -- check release` | Preserves coverage, evidence-only maintainer validation, and install dry-run. |
| `generate:diagnostics-docs`, `generate:command-docs`, `generate:doc-governance` | `npm run llmf -- generate docs --write` | Drift mode is the default; mutation requires explicit `--write`. |
| `generate:adapters`, `generate:runtime-contracts`, `generate:behavior-surfaces` | `npm run llmf -- generate runtime --write` | The profile also checks or regenerates v6/v2 and workflow permissions before downstream runtime projections. |
| `generate:evaluation-profiles`, `generate:release-summary`, `generate:compatibility-evidence`, `generate:facts`, `generate:task-catalog`, `generate:control-plane`, `generate:evidence-levels`, `generate:quality-report` | `npm run llmf -- generate release --write` | Governed evidence and release projections run sequentially; task catalog precedes the final control-plane inventory. |

`llmf generate all` composes runtime, docs, and release profiles without a
shell. Every child command uses fixed argv, stops on the first failure, and
returns normalized JSON task evidence. `migrate:docs` remains separate because
it changes compatibility paths rather than regenerating an ordinary projection.
The aggregate owns 26 deterministic generation tasks: runtime has 7
(`contract-v6`, `workflow-permissions`, `runtime-contracts`,
`behavior-surfaces`, `adapters`, `second-product`, and `eval-corpus`); docs has
5 (`diagnostics-docs`, `command-docs`, `prompt-surface-report`,
`platform-evidence`, and `doc-governance`); release has 14 (`registry`,
`surface-inventory`, `compatibility-evidence`, `workflow-surfaces`,
`static-contract`, `adapter-simulation`, `critical-mutation`,
`real-task-benchmark`, `quality-report`, `project-state`, `fact-graph`,
`release-summary`, `task-catalog`, and `control-plane`). The release profile
therefore covers every governed deterministic evaluation projection before it
regenerates the quality report and downstream state projections.
Identity-bound candidate, checksum, release-evidence, and timing generators stay
separate because they require explicit inputs and must never guess release data.

The phase-two operating target is 80 root package scripts beneath the governed
safety ceiling of 100. Any new root shortcut must remove an existing shortcut
in the same change so this 20% control-plane headroom is not consumed.

## CI Check Map

| CI check | Source command or workflow | Coverage |
| --- | --- | --- |
| Required / Contracts | `.github/workflows/ci.yml` | Schemas, generated drift, docs/frontmatter, adapters, workflow contracts, inventory, agents, and workflow trust checks in one checkout. |
| Required / Tests | `npm test`, coverage, targeted critical mutation | Unit/integration/e2e, global and critical coverage, and 10 governed real high-risk mutations evaluated by baseline-prechecked isolated probes with dependency-closed module copies; uploads `.metrics/coverage/`. |
| Release readiness | `npm run validate:release-readiness`, `node scripts/validate-release-operational-readiness.mjs --mode <mode>` | Reports policy and external operational blockers separately from ordinary PR integrity; release workflows require ready state before side effects. |
| Required / Security | hooks, ShellCheck, fault injection, secret/distribution scans | Security guardrails and SARIF evidence in one scoped-permission job. |
| Required / Platform | Linux Node 22/24, Windows Node 22, macOS Node 22 matrix | Cross-platform contracts, Windows PowerShell/Bash, and macOS system Bash. |
| Required / Package | install dry-run and deterministic artifact tests | Package inventory, deterministic archive, build/runtime BOMs, build record, and reproducibility. |
| Conditional / Evidence Registry Integrity | `node scripts/validate-assistant-evidence.mjs` | Runs on `main`; validates checked-in evidence and never claims to execute an assistant. |
| Required / Aggregate | result aggregation | The only CI branch-protection check; fails unless every required consolidated lane succeeds. |
| Release Evidence | `node scripts/generate-release-evidence.mjs` | Machine-readable validation, coverage, install, live route, and checksum aggregation. |
| Validate GitHub Workflows | `node scripts/validate-github-workflows.mjs` | Workflow permissions, inventory, action SHA pinning, required checks, NPM Test gate, and smoke boundaries. |
| Dependency Review | `.github/workflows/dependency-review.yml` | Dependency graph comparison and dependency-review action. |
| Dependency vulnerability audit | `node scripts/audit-dependencies.mjs` | Network-backed npm advisory evidence against the committed lockfile. |
| Dependency license audit | `node scripts/audit-dependency-licenses.mjs` | Deterministic SPDX policy evidence for root, workspace, direct, transitive, optional, and development dependencies. |
| CodeQL / Analyze JavaScript | `.github/workflows/codeql.yml` | Code scanning for JavaScript. |

## Change Routing

| Change type | Minimum focused validation |
| --- | --- |
| Documentation only | `npm run validate:docs`, `git diff --check` |
| Command or skill behavior | `node scripts/lint-frontmatter.mjs`, `node scripts/validate-docs.mjs`, `node scripts/validate-surface-budget.mjs` |
| Hook scripts or config | `node scripts/validate-hooks.mjs`, hook `bash -n`, `node scripts/validate-runtime-smoke.mjs` |
| GitHub workflows | `node scripts/validate-github-workflows.mjs`, `npm run validate:maintainer` |
| Test coverage evidence | `npm run test:coverage:check`, `node scripts/validate-github-workflows.mjs` when CI upload wiring changes |
| Dependency policy or lockfile | `npm run validate:dependency-audit`, `npm run validate:license-audit`, `node scripts/validate-schemas.mjs` |
| Registry or plugin metadata | `node scripts/generate-registry.mjs --write`, `npm run validate:drift`, `node scripts/validate-schemas.mjs`, `node scripts/validate-registry-fixtures.mjs` |
| Release evidence | `npm run validate:maintainer`, `node scripts/generate-release-checksums.mjs`, install smoke dry-run, and isolated install smoke when promotion evidence requires it |
| Public surface inventory | `node scripts/generate-surface-inventory.mjs --write`, `node scripts/generate-surface-inventory.mjs`, `npm test` |

<!-- merged-from: docs/maintainers/task-catalog.md -->
## Complete Task Catalog

The current generated inventory of maintenance scripts, root npm shortcuts,
runnable validation tasks, and GitHub Actions jobs lives in
[task-catalog.generated.md](task-catalog.generated.md). Regenerate it only
through `node scripts/generate-task-catalog.mjs --write`; this validation index
does not keep a second embedded copy.

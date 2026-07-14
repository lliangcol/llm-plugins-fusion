# Maintainer Quickstart

Status: active
Date: 2026-06-24

Use this page for the shortest maintainer path from a planned change to the
right validation evidence. Keep repository facts in [CLAUDE.md](../../CLAUDE.md)
and use this document as an operational checklist. For the full gate inventory,
see [validation-index.md](validation-index.md).

## Common Change Paths

| Change | Edit | Minimum checks |
| --- | --- | --- |
| Documentation only | `README.md`, `docs/**`, `nova-plugin/docs/**`, `CLAUDE.md`, `AGENTS.md` | `npm run validate:docs`, `git diff --check` |
| Command or skill behavior | `nova-plugin/commands/**`, `nova-plugin/skills/**`, command docs | `node scripts/lint-frontmatter.mjs`, `node scripts/validate-docs.mjs`, `node scripts/validate-surface-budget.mjs` |
| Hooks or guardrails | `nova-plugin/hooks/**`, `scripts/validate-*.mjs`, runtime scripts | `node scripts/validate-hooks.mjs`, `bash -n nova-plugin/hooks/scripts/pre-write-check.sh`, `bash -n nova-plugin/hooks/scripts/post-audit-log.sh`, `node scripts/validate-runtime-smoke.mjs` |
| Registry or marketplace metadata | `.claude-plugin/registry.source.json`, `nova-plugin/.claude-plugin/plugin.json` | `node scripts/generate-registry.mjs --write`, `npm run validate:drift`, `node scripts/validate-schemas.mjs`, `node scripts/validate-registry-fixtures.mjs`, `node scripts/validate-claude-compat.mjs` |
| CI or release workflow | `.github/workflows/**`, release docs | `npm run validate:github-workflows`, `npm run ci:quick`, `npm run validate:maintainer`, review changed workflow trigger, permissions, workflow inventory, and required-check list, plus action SHA pins |
| Release preparation | version sources, `CHANGELOG.md`, generated marketplace outputs | `npm run validate:maintainer`, `node scripts/generate-release-checksums.mjs`, `node scripts/validate-plugin-install.mjs --dry-run`, isolated install smoke when promotion evidence requires it |
| Surface inventory | `scripts/generate-surface-inventory.mjs`, `docs/generated/surface-inventory.*` | `node scripts/generate-surface-inventory.mjs --write`, `node scripts/generate-surface-inventory.mjs`, `npm test` |

## Default Commands

```bash
npm run doctor
npm run demo:route
npm run demo:review
npm run test
npm run test:coverage
npm run test:coverage:check
npm run test:unit
npm run test:integration
npm run test:e2e
npm run lint
npm run ci:quick
npm run ci:full
npm run validate:drift
npm run validate:maintainer
npm run validate:github-workflows
node scripts/generate-surface-inventory.mjs
```

`npm run ci:full` maps to `node scripts/validate-all.mjs`, which prints
per-gate timings. To write local timing evidence, run:

```bash
node scripts/validate-all.mjs --write-timings
```

The timing file is written under `.metrics/`, which is ignored and must not be
committed.

`.node-version` records the intended Node major for local maintainers. Treat
`package.json` `engines.node` as the canonical support contract when the two
ever need reconciliation.

`package.json` also pins the expected npm baseline through `packageManager`.
Use Corepack or an equivalent local toolchain manager when the active npm
version differs; CI continues to use `npm ci --ignore-scripts` against the
locked dependency graph.

The complete local security group also requires ShellCheck and actionlint.
`npm run doctor` reports both tools explicitly. On macOS with Homebrew, install
them with `brew install shellcheck actionlint`; then run `npm run
check:security`. CI downloads checksum-verified ShellCheck `0.11.0` and
actionlint `1.7.12`, so release evidence should use those versions or the CI
security lane when the local package manager provides a different build.

`npm run typecheck` uses the locked TypeScript and Node declarations to check
the JavaScript adapters, framework modules, distributed plugin runtime,
workspace packages, and maintenance scripts without emitting files. The
workspace validator owns this scope so it cannot silently narrow to one
package family.

After `npm ci --ignore-scripts`, collect test coverage evidence with Node's
built-in coverage runtime:

```bash
npm run test:coverage:check
```

This uses Node's built-in test coverage support and writes raw V8 coverage plus
a text summary under `.metrics/coverage/`. The `--check` path enforces lines
85%, branches 70%, and functions 90%. `NOVA_COVERAGE_LINES`,
`NOVA_COVERAGE_BRANCHES`, and `NOVA_COVERAGE_FUNCTIONS` can override those
values for an explicit maintainer experiment; `npm run test:coverage` remains
collection-only.

Run the focused generated-output gate when registry source, plugin metadata, or
marketplace catalog files are in scope:

```bash
npm run validate:drift
```

For release evidence, generate checksums for the selected source-controlled
release artifacts:

```bash
node scripts/generate-release-checksums.mjs
```

The checksum file is written under `.metrics/release-checksums/`, which is
ignored locally and uploaded by the release workflow.

## Diagnostic Result Semantics

Run `npm run validate:bootstrap` for a read-only machine-readable bootstrap
check. Use `npm run doctor -- --json` or `--output-json <path>` when a support
artifact is required. All reason codes and remediation anchors are generated in
[diagnostics.md](diagnostics.md); a skipped, blocked, warning, or failed result
must not be reported as passed.

`npm run doctor` is read-only and may return warnings for optional or
state-dependent checks. Treat them as evidence to record, not as automatic
failures:

| Signal | Meaning | Release handling |
| --- | --- | --- |
| `Claude CLI: WARN` | Default repository gates can still run, but live Claude plugin validation and user-scope install smoke are not proven locally. | Use `node scripts/validate-plugin-install.mjs --dry-run` for preview and collect mutation smoke evidence only in CI or an isolated test user. |
| `Codex CLI: WARN` | Ordinary five-stage workflow checks can still run, but Codex loop commands are not locally executable. | Do not claim Codex review/fix/verify runtime behavior was proven. |
| `Bash: WARN` or `skipped>0` | Windows local validation may skip Bash-dependent hook syntax or runtime smoke checks. | Record the skipped checks and rely on CI/Linux Bash evidence before promotion. |
| `ShellCheck: WARN` or `actionlint: WARN` | The complete local security group cannot run. | Install the pinned-compatible tools or rely on the checksum-verified CI security lane before promotion. |
| `Exact release tag: WARN` | The current checkout is a development snapshot, not release evidence. | Build and verify a signed `v<plugin-version>-rc.<number>` candidate before creating the stable tag at the same commit. |
| `Git working tree: WARN` | Local edits are present. | Acceptable during development; release evidence must name the changed files or use a clean tagged checkout. |

`npm run validate:maintainer` fails only on hard gate failures. A passing
maintainer run can still print warnings such as missing optional CLIs, an
allowlisted surface-budget warning, or non-release tag state; carry those
warnings into the handoff instead of flattening them into "fully released".

`npm run check` runs the coverage-owned complete test inventory first, then
`validate:maintainer:evidence` rechecks generated registry drift and both Git
diff whitespace boundaries without rerunning the same unit, integration, e2e,
and `validate-all` commands. Use the full `validate:maintainer` command when no
coverage run is available to reuse.

## Install Smoke Boundary

Use the safe preview by default:

```bash
node scripts/validate-plugin-install.mjs --dry-run
```

Run the mutation path only in CI or an isolated test-user environment:

```bash
node scripts/validate-plugin-install.mjs --accept-user-scope-mutation --isolated-home
```

The scheduled/manual `Plugin Install Smoke` workflow runs on a disposable
GitHub-hosted runner with temporary HOME/XDG directories and is the preferred
place for this evidence.

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
| Release preparation | version sources, `CHANGELOG.md`, generated marketplace outputs | `npm run validate:maintainer`, `node scripts/validate-plugin-install.mjs --dry-run`, isolated install smoke when promotion evidence requires it |
| Surface inventory | `scripts/generate-surface-inventory.mjs`, `docs/generated/surface-inventory.*` | `node scripts/generate-surface-inventory.mjs --write`, `node scripts/generate-surface-inventory.mjs`, `npm test` |

## Default Commands

```bash
npm run doctor
npm run test
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

Run the focused generated-output gate when registry source, plugin metadata, or
marketplace catalog files are in scope:

```bash
npm run validate:drift
```

## Diagnostic Result Semantics

`npm run doctor` is read-only and may return warnings for optional or
state-dependent checks. Treat them as evidence to record, not as automatic
failures:

| Signal | Meaning | Release handling |
| --- | --- | --- |
| `Claude CLI: WARN` | Default repository gates can still run, but live Claude plugin validation and user-scope install smoke are not proven locally. | Use `node scripts/validate-plugin-install.mjs --dry-run` for preview and collect mutation smoke evidence only in CI or an isolated test user. |
| `Codex CLI: WARN` | Ordinary five-stage workflow checks can still run, but Codex loop commands are not locally executable. | Do not claim Codex review/fix/verify runtime behavior was proven. |
| `Bash: WARN` or `skipped>0` | Windows local validation may skip Bash-dependent hook syntax or runtime smoke checks. | Record the skipped checks and rely on CI/Linux Bash evidence before promotion. |
| `Exact release tag: WARN` | The current checkout is a development snapshot, not stable release evidence. | Do not promote as stable until an exact `v<plugin-version>` tag is verified. |
| `Git working tree: WARN` | Local edits are present. | Acceptable during development; release evidence must name the changed files or use a clean tagged checkout. |

`npm run validate:maintainer` fails only on hard gate failures. A passing
maintainer run can still print warnings such as missing optional CLIs, an
allowlisted surface-budget warning, or non-release tag state; carry those
warnings into the handoff instead of flattening them into "fully released".

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

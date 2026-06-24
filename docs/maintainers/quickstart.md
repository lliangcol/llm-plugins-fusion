# Maintainer Quickstart

Status: active
Date: 2026-06-24

Use this page for the shortest maintainer path from a planned change to the
right validation evidence. Keep repository facts in [CLAUDE.md](../../CLAUDE.md)
and use this document as an operational checklist.

## Common Change Paths

| Change | Edit | Minimum checks |
| --- | --- | --- |
| Documentation only | `README.md`, `docs/**`, `nova-plugin/docs/**`, `CLAUDE.md`, `AGENTS.md` | `npm run validate:docs`, `git diff --check` |
| Command or skill behavior | `nova-plugin/commands/**`, `nova-plugin/skills/**`, command docs | `node scripts/lint-frontmatter.mjs`, `node scripts/validate-docs.mjs`, `node scripts/validate-surface-budget.mjs` |
| Hooks or guardrails | `nova-plugin/hooks/**`, `scripts/validate-*.mjs`, runtime scripts | `node scripts/validate-hooks.mjs`, `bash -n nova-plugin/hooks/scripts/pre-write-check.sh`, `bash -n nova-plugin/hooks/scripts/post-audit-log.sh`, `node scripts/validate-runtime-smoke.mjs` |
| Registry or marketplace metadata | `.claude-plugin/registry.source.json`, `nova-plugin/.claude-plugin/plugin.json` | `node scripts/generate-registry.mjs --write`, `node scripts/validate-schemas.mjs`, `node scripts/validate-registry-fixtures.mjs`, `node scripts/validate-claude-compat.mjs` |
| CI or release workflow | `.github/workflows/**`, release docs | `npm run ci:quick`, `npm run validate:maintainer`, review changed workflow trigger and permissions |
| Release preparation | version sources, `CHANGELOG.md`, generated marketplace outputs | `npm run validate:maintainer`, `node scripts/validate-plugin-install.mjs --dry-run`, isolated install smoke when promotion evidence requires it |

## Default Commands

```bash
npm run doctor
npm run test
npm run lint
npm run ci:quick
npm run ci:full
npm run validate:maintainer
```

`npm run ci:full` maps to `node scripts/validate-all.mjs`, which prints
per-gate timings. To write local timing evidence, run:

```bash
node scripts/validate-all.mjs --write-timings
```

The timing file is written under `.metrics/`, which is ignored and must not be
committed.

## Install Smoke Boundary

Use the safe preview by default:

```bash
node scripts/validate-plugin-install.mjs --dry-run
```

Run the mutation path only in CI or an isolated test-user environment:

```bash
node scripts/validate-plugin-install.mjs --accept-user-scope-mutation
```

The scheduled/manual `Plugin Install Smoke` workflow runs on a disposable
GitHub-hosted runner and is the preferred place for this evidence.

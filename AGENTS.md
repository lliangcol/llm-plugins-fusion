# AGENTS.md

This file is the Codex and generic AI-agent adapter for this repository.
Use [CLAUDE.md](CLAUDE.md) as the canonical project guidance for shared
repository facts, architecture contracts, change workflows, and quality gates.
Keep this file short: it should repeat only the inventory lines validated by
`node scripts/validate-docs.mjs` and the behavior that differs outside Claude
Code.

## Project Baseline

**LLM Plugins Fusion** is a public multi-project AI engineering workflow
framework for LLM coding assistants. The primary deliverable is `nova-plugin`,
distributed through the Claude Code marketplace format and organized around:

```text
Explore -> Plan -> Review -> Implement -> Finalize
```

Marketplace metadata is the current installation and distribution mechanism.
Do not describe this repository as a mature multi-plugin ecosystem or a public
portal unless future roadmap and implementation evidence support that claim.
Public docs may include generic workflow guidance, consumer profile contracts,
redacted examples, prompt templates, and capability pack guidance. Real
consumer profiles belong in the consumer project's own `AGENTS.md`,
`CLAUDE.md`, `.claude/`, or private docs.

## Current Inventory

- Commands: 21 files under `nova-plugin/commands/*.md`
- Skills: 21 files under `nova-plugin/skills/nova-*/SKILL.md`
- Active agents: 6 core files under `nova-plugin/agents/*.md`
- Capability packs: 8 documentation packs under `nova-plugin/packs/*/README.md`

Additional facts are owned by these source files:

| Area | Source |
| --- | --- |
| Claude Code repository guidance | [CLAUDE.md](CLAUDE.md) |
| Plugin metadata and version | `nova-plugin/.claude-plugin/plugin.json` |
| Registry-owned marketplace fields | `.claude-plugin/registry.source.json` |
| Generated marketplace outputs | `.claude-plugin/marketplace.json`, `.claude-plugin/marketplace.metadata.json`, `docs/marketplace/catalog.md` |
| Commands and skills | `nova-plugin/commands/`, `nova-plugin/skills/` |
| Active agents and packs | `nova-plugin/agents/`, `nova-plugin/packs/` |
| Repository docs index | `docs/README.md` |
| Plugin docs index | `nova-plugin/docs/README.md` |

Generated marketplace files must be updated from their sources with:

```bash
node scripts/generate-registry.mjs --write
```

## Agent Rules

- Start from the actual file tree. Use `rg --files -uu` or an equivalent scan,
  excluding `.git/`, `.codex/`, dependency directories, build outputs, caches,
  logs, and temporary files.
- Treat [CLAUDE.md](CLAUDE.md) as the shared rule source. If this file and
  `CLAUDE.md` conflict, follow `CLAUDE.md` for repository contracts and then
  update this adapter if the difference affects non-Claude agents.
- Do not assume Claude slash-command runtime behavior outside Claude Code.
  Generic agents should read the command and skill Markdown as contracts and
  execute normal repository edits and validation commands directly.
- Keep public repository content free of private consumer names, local machine
  paths, endpoints, credentials, repository addresses, runtime flags, business
  rules, and private knowledge-base content.
- Do not commit Codex runtime artifacts from `.codex/`, including timestamped
  review/fix runs, `latest`, and `latest-artifacts/`.
- Do not recreate retired `.claude/agents/` archive paths as active agent
  locations. Active agents live only in `nova-plugin/agents/`.
- Do not hand-edit generated marketplace outputs. Edit
  `.claude-plugin/registry.source.json` or
  `nova-plugin/.claude-plugin/plugin.json`, then run the generator.
- Preserve command/skill one-to-one mapping:

```text
nova-plugin/commands/<id>.md
nova-plugin/skills/nova-<id>/SKILL.md
```

## Non-Claude Execution Notes

- `allowed-tools` and `destructive-actions` in command/skill frontmatter are
  Claude-facing constraints, but other agents must still respect their intent.
- Review and Explore commands should not modify project code.
- Non-implementation commands may write only explicit artifacts such as
  analysis, plan, review, or verification files.
- Within the Codex command set, only `codex-review-fix` may modify project
  files. `codex-review-only` and `codex-verify-only` should create only review
  or verification artifacts.
- Bash-dependent checks count as locally passed only when Bash actually runs.
  Windows warning-skips from `node scripts/validate-all.mjs` must be reported
  as skipped, not passed.

## Common Checks

Default full validation:

```bash
node scripts/validate-all.mjs
```

Focused checks:

```bash
node scripts/generate-registry.mjs
node scripts/validate-schemas.mjs
node scripts/validate-registry-fixtures.mjs
node scripts/validate-claude-compat.mjs
node scripts/lint-frontmatter.mjs
bash scripts/verify-agents.sh
node scripts/validate-packs.mjs
node scripts/validate-hooks.mjs
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
node scripts/validate-runtime-smoke.mjs
node scripts/scan-distribution-risk.mjs
node scripts/validate-regression.mjs
node scripts/validate-docs.mjs
```

Windows agent verification:

```powershell
.\scripts\verify-agents.ps1
```

Maintainer npm shortcuts in `package.json` are dependency-free and deliberately
avoid `check`, `lint`, `test`, and `build` script names:

```bash
npm run validate
npm run validate:docs
npm run validate:schemas
npm run validate:runtime
npm run validate:regression
npm run scan:distribution
```

Consumer profile scaffolding through npm requires arguments:

```bash
npm run scaffold:consumer -- --type java-backend --out <dir>
```

`node scripts/validate-plugin-install.mjs` is intentionally separate because it
may install or update a user-scope Claude Code plugin.

## Change Boundaries

- Existing command behavior changes require updates to the matching command,
  skill, command docs, user-facing docs when behavior changes, and
  `CHANGELOG.md` when public behavior, parameters, outputs, tool permissions,
  or safety boundaries change.
- New commands require the command file, matching skill, and three command docs.
  Codex command docs live under `nova-plugin/docs/commands/codex/`; other
  command docs live under `nova-plugin/docs/commands/<stage>/`.
- Metadata or version changes require regenerated marketplace outputs and the
  schema / registry / Claude-compatibility checks listed in [CLAUDE.md](CLAUDE.md).
- Agent or pack set changes require matching updates to files, verification
  scripts, routing docs, migration notes when relevant, [CLAUDE.md](CLAUDE.md),
  and this file.

## Review Units

For broad repository work, review in small units and record evidence:

| Unit | Common files | Focused checks |
| --- | --- | --- |
| Memory and docs | `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/**`, `nova-plugin/docs/**` | `node scripts/validate-docs.mjs` |
| Skills and commands | `nova-plugin/commands/**`, `nova-plugin/skills/**` | `node scripts/lint-frontmatter.mjs` |
| Guardrails | `nova-plugin/hooks/**`, `scripts/validate-*.mjs`, distributed Bash scripts | `node scripts/validate-hooks.mjs`, hook `bash -n`, `node scripts/validate-regression.mjs` when validator behavior changes |
| Delegation | `nova-plugin/agents/**`, `nova-plugin/packs/**`, `docs/agents/**` | `bash scripts/verify-agents.sh` or `.\scripts\verify-agents.ps1`, plus `node scripts/validate-packs.mjs` |
| Distribution | `.claude-plugin/registry.source.json`, `nova-plugin/.claude-plugin/plugin.json`, generated marketplace outputs | `node scripts/generate-registry.mjs --write`, schema checks, registry fixture checks, Claude compatibility checks |

## Retired Paths

- `.claude/agents/**`
- `docs/reports/**`
- `nova-plugin/docs/history/**`

These paths are not current documentation surfaces. Do not recreate them for
new work unless a maintainer explicitly reintroduces a documented archive or
history policy.

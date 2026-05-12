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

Additional facts are owned by these source files. If an adapter note conflicts
with one of these files, follow the listed source and update this file only when
the non-Claude behavior needs to change.

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

- For broad repository work, follow the file-tree scan rule in
  [CLAUDE.md](CLAUDE.md). Outside Claude Code, use `rg --files -uu` or an
  equivalent scan and apply the same exclusions before grouping review units.
- For broad or multi-step work, record per-unit evidence, verified behavior or
  facts, skipped checks, and residual risk before moving to the next unit.
- When this adapter, command docs, skills, or `CLAUDE.md` disagree, report the
  conflict and follow `CLAUDE.md` or the matching source listed above instead
  of averaging behaviors.
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

## Validation

Use [CLAUDE.md](CLAUDE.md#common-checks) for the full current validation list.
The default full validation remains:

```bash
node scripts/validate-all.mjs
```

Maintainer validation npm shortcuts in `package.json` are dependency-free:

```bash
npm run validate
npm run validate:docs
npm run validate:schemas
npm run validate:runtime
npm run validate:regression
npm run validate:surface
npm run scan:distribution
```

Windows agent verification uses:

```powershell
.\scripts\verify-agents.ps1
```

`node scripts/validate-plugin-install.mjs` is intentionally separate because it
may install or update a user-scope Claude Code plugin.

## Change Boundaries

- Use [CLAUDE.md](CLAUDE.md#change-workflows) for command, skill, metadata,
  agent, pack, and version change workflows.
- Keep this adapter updated only for inventory changes or rules that affect
  Codex and generic agents differently from Claude Code.
- Retired paths are not current documentation surfaces: `.claude/agents/**`,
  `docs/reports/**`, and `nova-plugin/docs/history/**`. Do not recreate them
  unless a maintainer explicitly reintroduces a documented archive or history
  policy.

## Review Units

For broad repository work, use the quality-gate table in
[CLAUDE.md](CLAUDE.md#quality-gates), process one coherent unit at a time, and
record the evidence and residual risk before moving to the next unit.

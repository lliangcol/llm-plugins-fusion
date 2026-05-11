# CLAUDE.md

This file provides canonical Claude Code guidance for this repository. Keep
`AGENTS.md` as a short Codex / generic-agent adapter that references this file
instead of copying it wholesale. When repository structure, command counts,
validation rules, or workflow constraints change, update this file first and
then update only the affected adapter notes in `AGENTS.md`.

## Project Purpose

**LLM Plugins Fusion** is a public multi-project AI engineering workflow
framework for LLM coding assistants. The primary plugin is `nova-plugin`, which
is distributed through the Claude Code marketplace format and supports:

```text
Explore -> Plan -> Review -> Implement -> Finalize
```

Marketplace metadata is the current installation and distribution mechanism.
Do not describe this repository as a mature multi-plugin ecosystem unless
future evidence and roadmap updates say so. Public docs may include generic
workflow guidance, consumer profile contracts, redacted examples, prompt
templates, and capability pack guidance. Real consumer profiles belong in the
consumer project's own `AGENTS.md`, `CLAUDE.md`, `.claude/`, or private docs.

## Quick Facts

- Marketplace entry: `.claude-plugin/marketplace.json`
- Marketplace custom metadata: `.claude-plugin/marketplace.metadata.json`
- Registry generation source: `.claude-plugin/registry.source.json`
- Registry multi-entry fixture: `fixtures/registry/multi-plugin/`
- Generated marketplace catalog: `docs/marketplace/catalog.md`
- Main plugin metadata and version source: `nova-plugin/.claude-plugin/plugin.json`
- Current command snapshot: 21 files under `nova-plugin/commands/*.md`; validate frontmatter with `node scripts/lint-frontmatter.mjs`.
- Current skill snapshot: 21 files under `nova-plugin/skills/nova-*/SKILL.md`; validate frontmatter with `node scripts/lint-frontmatter.mjs`.
- Command docs: each command has `<id>.md`, `<id>.README.md`, and `<id>.README.en.md` under `nova-plugin/docs/commands/**/`; validate with `node scripts/validate-docs.mjs`.
- Shared skill policies: `nova-plugin/skills/_shared/*.md`
- Current active agent snapshot: 6 core files under `nova-plugin/agents/*.md`; verify with `bash scripts/verify-agents.sh` or `.\scripts\verify-agents.ps1`.
- Capability pack snapshot: 8 documentation packs under `nova-plugin/packs/*/README.md`; validate with `node scripts/validate-packs.mjs`.
- Consumer profile templates: `docs/consumers/`
- Redacted workflow examples: `docs/examples/`
- Prompt template library: `docs/prompts/`
- Workflow guidance: `docs/workflows/`
- Repository docs index: `docs/README.md`
- Project optimization plan: `docs/project-optimization-plan.md`
- Release evidence template: `docs/releases/release-evidence-template.md`
- Maintainer npm shortcuts: `package.json` (`validate`, `validate:docs`,
  `validate:schemas`, `validate:runtime`, `validate:regression`,
  `scan:distribution`, `scaffold:consumer`; no `check`/`lint`/`test`/`build`
  script names)
- Repository validation scripts require Node.js 20+. Hook shell syntax and
  runtime smoke checks require Bash; Windows without Bash may warning-skip
  local Bash-dependent checks, while CI/Linux must run them.

## Sources of Truth

| Area | Source |
| --- | --- |
| Plugin metadata and version | `nova-plugin/.claude-plugin/plugin.json` |
| Registry-owned marketplace fields | `.claude-plugin/registry.source.json` |
| Generated marketplace outputs | `.claude-plugin/marketplace.json`, `.claude-plugin/marketplace.metadata.json`, `docs/marketplace/catalog.md` |
| Marketplace and plugin schemas | `schemas/registry-source.schema.json`, `schemas/marketplace.schema.json`, `schemas/marketplace-metadata.schema.json`, `schemas/plugin.schema.json` |
| Commands | `nova-plugin/commands/*.md` |
| Skills | `nova-plugin/skills/nova-*/SKILL.md` |
| Shared skill policies | `nova-plugin/skills/_shared/` |
| Command docs | `nova-plugin/docs/commands/` |
| Active agents | `nova-plugin/agents/` |
| Capability packs | `nova-plugin/packs/` |
| Consumer templates | `docs/consumers/` |
| Examples and workflow evaluation | `docs/examples/` |
| Prompt templates | `docs/prompts/` |
| Workflow guidance | `docs/workflows/` |
| Project optimization record | `docs/project-optimization-plan.md` |
| Release evidence and hygiene | `docs/releases/` |

Generated marketplace files must be updated from their sources with:

```bash
node scripts/generate-registry.mjs --write
```

## Repository Layout

```text
llm-plugins-fusion/
|-- .claude-plugin/
|   |-- registry.source.json
|   |-- marketplace.json
|   `-- marketplace.metadata.json
|-- .github/workflows/
|   |-- ci.yml
|   `-- release.yml
|-- docs/
|   |-- README.md
|   |-- agents/
|   |-- consumers/
|   |-- examples/
|   |-- marketplace/
|   |-- prompts/
|   |-- releases/
|   |-- workflows/
|   `-- project-optimization-plan.md
|-- fixtures/registry/multi-plugin/
|-- nova-plugin/
|   |-- .claude-plugin/plugin.json
|   |-- commands/                     # 21 Claude Code command definitions
|   |-- skills/                       # 21 Agent Skills mapped one-to-one with commands
|   |-- agents/                       # 6 core active agents
|   |-- packs/                        # 8 capability pack docs
|   |-- docs/
|   `-- hooks/
|-- schemas/
|-- scripts/
|-- README.md
|-- CLAUDE.md
|-- AGENTS.md
|-- CODE_OF_CONDUCT.md
|-- CONTRIBUTING.md
|-- CHANGELOG.md
|-- ROADMAP.md
`-- SECURITY.md
```

## Common Checks

Default non-mutating repository checks:

```bash
node scripts/validate-all.mjs
```

Targeted checks:

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

Maintainer npm shortcuts are optional and dependency-free:

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

Windows agent verification:

```powershell
.\scripts\verify-agents.ps1
```

Claude CLI install smoke is intentionally separate because it may install or
update a user-scope plugin:

```bash
node scripts/validate-plugin-install.mjs
```

Consumer profile scaffolding is dry-run by default:

```bash
node scripts/scaffold-consumer-profile.mjs --type java-backend --out <dir>
node scripts/scaffold-consumer-profile.mjs --type frontend --out <dir>
node scripts/scaffold-consumer-profile.mjs --type workbench --out <dir>
```

If Bash is not installed on Windows, `node scripts/validate-all.mjs` warns and
skips local Bash-dependent checks. Do not report hook syntax or runtime smoke
checks as locally passed unless Bash actually ran them.

## Architecture Contracts

### Registry and Marketplace

- `.claude-plugin/registry.source.json` owns registry-level marketplace data,
  plugin source paths, category, tags, and repository-local
  trust/risk/deprecation/`last-updated`, maintainer, compatibility, and review
  metadata.
- `.claude-plugin/marketplace.json`,
  `.claude-plugin/marketplace.metadata.json`, and
  `docs/marketplace/catalog.md` are generated outputs.
- Repository-local fields such as `trust-level`, `risk-level`, `deprecated`,
  `last-updated`, `maintainer`, `compatibility`, and `review` must not leak
  into the Claude-compatible marketplace manifest.

### Commands and Skills

Commands and skills must stay one-to-one:

```text
nova-plugin/commands/<id>.md
nova-plugin/skills/nova-<id>/SKILL.md
```

Command frontmatter must include:

```yaml
id: <id>
stage: explore|plan|implement|review|finalize
title: /<id>
description: "When to use this command..."
destructive-actions: none|low|medium|high
allowed-tools: <space-separated tool list>
invokes:
  skill: nova-<id>
```

Skill frontmatter must include:

```yaml
name: nova-<id>
description: "..."
license: MIT
allowed-tools: <space-separated tool list>
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: true|false
    destructiveActions: none|low|medium|high
```

Read-only commands normally use `allowed-tools: Read Glob Grep LS`. Write-capable
implementation commands may also use `Write Edit MultiEdit Bash`.

Command documentation normally lives under `nova-plugin/docs/commands/<stage>/`.
Codex commands are the explicit exception: `codex-review-fix`,
`codex-review-only`, and `codex-verify-only` are documented together under
`nova-plugin/docs/commands/codex/`.

### Command System

| Stage | Commands | Purpose |
| --- | --- | --- |
| Explore | `route`, `senior-explore`, `explore`, `explore-lite`, `explore-review` | Route selection, understanding, fact gathering, and review-oriented exploration |
| Plan | `plan-lite`, `plan-review`, `produce-plan`, `backend-plan` | Lightweight planning, formal planning, and Java/Spring backend planning |
| Review | `review`, `review-lite`, `review-only`, `review-strict`, `codex-review-only`, `codex-verify-only` | Human review entry points and Codex-based verification |
| Implement | `implement-plan`, `implement-standard`, `implement-lite`, `codex-review-fix` | Plan-based implementation, standard implementation, lightweight implementation, and Codex-driven fix loops |
| Finalize | `finalize-work`, `finalize-lite` | Delivery summaries and handoff |

- `/route` is read-only and recommends the next command, skill, core agent,
  capability packs, required inputs, validation expectations, and fallback path.
- `/explore` routes by `PERSPECTIVE=observer|reviewer`.
- `/review` adjusts depth by `LEVEL=lite|standard|strict`.
- `codex-review-only` writes review artifacts only.
- `codex-review-fix` runs review -> Claude Code fix -> local checks -> verify.
- `codex-verify-only` verifies against an existing review and optional checks.

### Active Agents and Capability Packs

Active agents are exactly:

```text
architect
builder
orchestrator
publisher
reviewer
verifier
```

Capability packs are exactly: `java`, `security`, `dependency`, `docs`,
`release`, `marketplace`, `frontend`, and `mcp`.

Active agents live in `nova-plugin/agents/`. Capability packs live in
`nova-plugin/packs/` and must document both enhanced mode and fallback mode.

If the active agent or pack set changes, update the files, verification scripts,
routing docs, migration notes when relevant, `CLAUDE.md`, and `AGENTS.md`.

### Hooks

`nova-plugin/hooks/hooks.json` enables:

- `PreToolUse`: matches `Write|Edit|MultiEdit` and runs
  `hooks/scripts/pre-write-check.sh` through Bash.
- `PostToolUse`: matches `Write|Edit|MultiEdit|Bash` and asynchronously runs
  `hooks/scripts/post-audit-log.sh` through Bash.

Hook scripts rely on `CLAUDE_PLUGIN_ROOT`. Invoke `.sh` scripts explicitly
through Bash unless the scripts are deliberately tracked with a Unix executable
bit.

## Change Workflows

### Modify an Existing Command

1. Edit `nova-plugin/commands/<id>.md`.
2. Edit `nova-plugin/skills/nova-<id>/SKILL.md`.
3. Update command docs or `nova-plugin/skills/README.md` when user-facing
   behavior changes.
4. Update `CHANGELOG.md` and decide whether a version bump is required when
   behavior, parameters, outputs, tool permissions, or safety boundaries change.
5. Run `node scripts/lint-frontmatter.mjs`.

### Add a New Command and Skill

Every new command must have a matching skill and three command docs:

```text
nova-plugin/commands/<id>.md
nova-plugin/skills/nova-<id>/SKILL.md
nova-plugin/docs/commands/<stage>/<id>.md
nova-plugin/docs/commands/<stage>/<id>.README.md
nova-plugin/docs/commands/<stage>/<id>.README.en.md
```

For Codex commands, place the three docs under
`nova-plugin/docs/commands/codex/` instead of a stage directory.

Also update `README.md`, `CHANGELOG.md`, `nova-plugin/skills/README.md`,
`CLAUDE.md`, `AGENTS.md`, plugin version metadata, registry source, generated
marketplace outputs, and generated catalog when counts, version, or public
behavior change. Run `node scripts/validate-all.mjs`.

### Modify Plugin Metadata or Version

Version information is synchronized across:

- `nova-plugin/.claude-plugin/plugin.json`
- `.claude-plugin/registry.source.json`
- generated marketplace outputs and catalog
- `CHANGELOG.md`
- `README.md`, `SECURITY.md`, `CLAUDE.md`, and `AGENTS.md` when facts or
  supported version ranges change

Versioning follows SemVer:

- MAJOR: command deletion, command rename, or incompatible behavior changes.
- MINOR: new command, skill, agent, or significant capability expansion.
- PATCH: bug fix, documentation update, internal refactor, or metadata correction.

After metadata or schema changes, run:

```bash
node scripts/generate-registry.mjs --write
node scripts/validate-schemas.mjs
node scripts/validate-registry-fixtures.mjs
node scripts/validate-claude-compat.mjs
```

Release tags must use `v<plugin-version>` and match
`nova-plugin/.claude-plugin/plugin.json` exactly.

### Modify Agents or Capability Packs

- Active agents belong only in `nova-plugin/agents/`; do not recreate retired
  `.claude/agents/` archive paths as active agent locations.
- If the active agent or pack set changes, update agent or pack files, both
  `verify-agents` scripts, `scripts/validate-packs.mjs`, routing docs,
  migration notes when relevant, `CLAUDE.md`, and `AGENTS.md`.
- Agent frontmatter uses `name`, `description`, and `tools`; keep agent bodies
  short and route-focused.

## Quality Gates

Run focused checks for narrow changes and `node scripts/validate-all.mjs` for
broad workflow, release, metadata, or cross-layer changes.

| Layer changed | Common files | Focused checks |
| --- | --- | --- |
| Memory and docs | `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/**`, `nova-plugin/docs/**` | `node scripts/validate-docs.mjs` |
| Skills and commands | `nova-plugin/commands/**`, `nova-plugin/skills/**` | `node scripts/lint-frontmatter.mjs` |
| Guardrails | `nova-plugin/hooks/**`, `scripts/validate-*.mjs`, distributed Bash scripts | `node scripts/validate-hooks.mjs`, hook `bash -n`, changed script validation, `node scripts/validate-regression.mjs` when validator behavior changes |
| Delegation | `nova-plugin/agents/**`, `nova-plugin/packs/**`, `docs/agents/**` | `bash scripts/verify-agents.sh` or `.\scripts\verify-agents.ps1`, plus `node scripts/validate-packs.mjs` |
| Distribution | `.claude-plugin/registry.source.json`, `nova-plugin/.claude-plugin/plugin.json`, generated marketplace outputs | `node scripts/generate-registry.mjs --write`, `node scripts/validate-schemas.mjs`, `node scripts/validate-registry-fixtures.mjs`, `node scripts/validate-claude-compat.mjs`; `node scripts/validate-plugin-install.mjs` when install smoke is required |

`node scripts/validate-docs.mjs` validates Markdown links and anchors, command
doc coverage and stage placement, version/date sync, inventory counts, current
security support range, stale active planning labels, and non-archived report
status.

Current CI includes verify-agents, validate-packs, validate-schemas,
validate-registry-fixtures, validate-claude-compat, plugin install smoke,
lint-frontmatter, validate-hooks, hook `bash -n`, runtime smoke, distribution
risk scan, validation regression checks, and validate-docs.

## Do Not Edit

- Do not commit Codex runtime artifacts from `.codex/`, including timestamped
  `codex-review-fix` runs, `latest`, and `latest-artifacts/`.
- Do not recreate retired `.claude/agents/` archive paths as active agent
  locations. Active agents belong only in `nova-plugin/agents/`.

## Key Constraints

- Broad repository work must start from the actual file tree. Use
  `rg --files -uu` or an equivalent scan, then exclude `.git/`, `.codex/`,
  dependency directories, build outputs, IDE directories, caches, logs, and
  temporary/runtime artifacts before grouping review units.
- `commands/*.md` and `skills/nova-*/SKILL.md` must remain one-to-one.
- Every command must have three command docs; Codex command docs are centralized
  under `nova-plugin/docs/commands/codex/`.
- `allowed-tools` must be a space-separated string, not a YAML array.
- `destructive-actions` must be `none`, `low`, `medium`, or `high`.
- `nova-plugin/agents/` must match the exact 6 core-agent file set.
- `nova-plugin/packs/` must contain exactly 8 documented capability packs, and
  each pack README must include enhanced mode and fallback mode.
- User-facing behavior changes require documentation and `CHANGELOG.md` updates.
- Generated marketplace outputs must be regenerated from source files.
- Review and Explore commands should not modify project code.
- Non-implementation commands may declare write tools only for explicit
  artifacts such as analysis, plan, review, or verification files.
- Within the Codex set, only `codex-review-fix` should modify project files.
  `codex-review-only` and `codex-verify-only` should create only review or
  verification artifacts.

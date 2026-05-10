# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Purpose

**LLM Plugins Fusion** is a public multi-project AI engineering workflow framework for LLM coding assistants. The current primary plugin is `nova-plugin`, which is distributed through the Claude Code marketplace format and provides an engineering workflow that spans Explore -> Plan -> Review -> Implement -> Finalize.

Marketplace metadata is the current installation and distribution mechanism; do not treat the repository as a mature multi-plugin ecosystem unless future evidence and roadmap updates say so. Public docs may include generic `nova-plugin` workflow guidance, consumer profile contracts, redacted Java backend/frontend templates, and capability pack guidance. Real consumer profiles belong in the consumer project's own `AGENTS.md`, `CLAUDE.md`, `.claude/`, or private docs.

## Quick Facts

- Marketplace entry: `.claude-plugin/marketplace.json`
- Marketplace custom metadata: `.claude-plugin/marketplace.metadata.json`
- Generated marketplace catalog: `docs/marketplace/catalog.md`
- Consumer profile templates: `docs/consumers/`
- Redacted workflow examples: `docs/examples/`
- Registry generation source: `.claude-plugin/registry.source.json`
- Registry multi-entry fixture: `fixtures/registry/multi-plugin/`
- Main plugin metadata: `nova-plugin/.claude-plugin/plugin.json`
- Plugin version source of truth: `nova-plugin/.claude-plugin/plugin.json`
- Current command snapshot: 20 files under `nova-plugin/commands/*.md`; validate frontmatter with `node scripts/lint-frontmatter.mjs`.
- Current skill snapshot: 20 files under `nova-plugin/skills/nova-*/SKILL.md`; validate frontmatter with `node scripts/lint-frontmatter.mjs`.
- Command docs: each command must have `<id>.md`, `<id>.README.md`, and `<id>.README.en.md` under `nova-plugin/docs/commands/**/`; validate with `node scripts/validate-docs.mjs`.
- Shared skill policies: `nova-plugin/skills/_shared/*.md`.
- Current active agent snapshot: 6 core files under `nova-plugin/agents/*.md`; verify with `bash scripts/verify-agents.sh` or `.\scripts\verify-agents.ps1`.
- Capability pack snapshot: 8 documentation packs under `nova-plugin/packs/*/README.md`; validate with `node scripts/validate-packs.mjs`.
- Repository validation scripts require Node.js 20+. Hook shell syntax checks require Bash; Windows without Bash may warning-skip local `bash -n`, while CI/Linux must run it.

## Sources of Truth

- Plugin-owned metadata, including version: `nova-plugin/.claude-plugin/plugin.json`.
- Registry-owned marketplace fields and custom metadata, including `last-updated`, maintainer, compatibility evidence, and review links: `.claude-plugin/registry.source.json`.
- Generated registry outputs: `.claude-plugin/marketplace.json`, `.claude-plugin/marketplace.metadata.json`, and `docs/marketplace/catalog.md`; regenerate with `node scripts/generate-registry.mjs --write`.
- Registry fixture coverage: `fixtures/registry/multi-plugin/`, enforced by `scripts/validate-registry-fixtures.mjs`.
- Command definitions: `nova-plugin/commands/*.md`.
- Skill definitions: `nova-plugin/skills/nova-*/SKILL.md`.
- Command documentation: `nova-plugin/docs/commands/`.
- Consumer profile templates: `docs/consumers/`.
- Redacted workflow examples: `docs/examples/`.
- Shared command/skill policies: `nova-plugin/skills/_shared/`.
- Active agent set: `nova-plugin/agents/`, enforced by `scripts/verify-agents.sh` and `scripts/verify-agents.ps1`.
- Capability packs: `nova-plugin/packs/`, enforced by `scripts/validate-packs.mjs`.
- Registry source, marketplace, marketplace metadata, and plugin schema contracts: `schemas/registry-source.schema.json`, `schemas/marketplace.schema.json`, `schemas/marketplace-metadata.schema.json`, and `schemas/plugin.schema.json`.

## Repository Layout

```text
claude-plugins-fusion/
|-- .claude-plugin/
|   |-- registry.source.json          # Human-maintained registry generation source
|   |-- marketplace.json              # Generated plugin marketplace entry
|   `-- marketplace.metadata.json     # Generated repository-local marketplace metadata
|-- .github/workflows/
|   |-- ci.yml                        # Agent, schema, and frontmatter checks
|   `-- release.yml                   # Tag-based release and release notes
|-- docs/
|   |-- agents/                       # Active agent routing and migration notes
|   |-- consumers/                    # Public consumer profile contract and redacted templates
|   |-- examples/                     # Redacted Java backend and frontend workflow examples
|   |-- marketplace/                  # Catalog, author workflow, compatibility, trust, review docs
|   `-- releases/                     # Release decision, runbook, and hygiene docs
|-- fixtures/
|   `-- registry/multi-plugin/        # Multi-entry registry generation fixture
|-- nova-plugin/
|   |-- .claude-plugin/plugin.json    # nova-plugin metadata and version
|   |-- commands/                     # 20 Claude Code command definitions
|   |-- skills/                       # 20 Agent Skills mapped one-to-one with commands
|   |-- agents/                       # 6 core active agents
|   |-- packs/                        # 8 capability pack docs
|   |-- docs/                         # Command, skill, Codex, and agent documentation
|   `-- hooks/                        # Claude Code hook config and scripts
|-- schemas/                          # Marketplace, metadata, and plugin JSON Schemas
|-- scripts/                          # Repository-level validation scripts
|-- README.md                         # User-facing overview and quickstart
|-- CLAUDE.md                         # Claude Code repository guidance
|-- AGENTS.md                         # Codex and generic AI agent guidance
|-- CONTRIBUTING.md                   # Contribution rules and metadata contracts
|-- CHANGELOG.md                      # Version history
|-- ROADMAP.md                        # Planned evolution
|-- SECURITY.md                       # Vulnerability reporting and security policy
`-- .claude/agents/archive/            # Archived legacy agents, not part of the active set
```

## Common Commands

All repository checks from one entry point:

```bash
node scripts/validate-all.mjs
```

Repository-level checks on Bash-compatible shells:

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
node scripts/validate-docs.mjs
```

Repository-level checks on Windows PowerShell:

```powershell
node scripts/generate-registry.mjs
node scripts/validate-schemas.mjs
node scripts/validate-registry-fixtures.mjs
node scripts/validate-claude-compat.mjs
node scripts/lint-frontmatter.mjs
.\scripts\verify-agents.ps1
node scripts/validate-packs.mjs
node scripts/validate-hooks.mjs
node scripts/validate-docs.mjs
node scripts/validate-all.mjs
```

If Bash is not installed on Windows, `node scripts/validate-all.mjs` warns and skips the local `bash -n` hook syntax checks. Do not report those syntax checks as locally passed unless Bash actually ran them.

## Architecture

### Plugin Discovery

- `.claude-plugin/registry.source.json` is the human-maintained source for registry generation. It owns registry-level marketplace data, plugin source paths, marketplace-only fields such as category and tags, and repository-local trust/risk/deprecation/`last-updated`, maintainer, compatibility, and review metadata.
- `.claude-plugin/marketplace.json` registers installable plugins and is generated from `registry.source.json` plus each plugin manifest.
- `.claude-plugin/marketplace.metadata.json` stores repository-local metadata and is generated from `registry.source.json` plus each plugin manifest.
- `docs/marketplace/catalog.md` is a generated Markdown catalog derived from the same registry source and plugin manifests.
- `nova-plugin/.claude-plugin/plugin.json` declares plugin name, version, author, license, keywords, homepage, and repository metadata.
- `nova-plugin/commands/*.md` contains Claude Code command definitions.
- `nova-plugin/skills/nova-*/SKILL.md` contains Agent Skill definitions discovered by directory convention.
- `nova-plugin/packs/*/README.md` documents optional capability packs used by core agents for domain-specific routing, enhanced mode, and fallback mode.
- `nova-plugin/hooks/hooks.json` defines safety checks and audit hooks around tool use.

### Commands and Skills

Commands and skills use a one-to-one mapping:

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

Read-only commands normally use:

```yaml
allowed-tools: Read Glob Grep LS
```

Write-capable implementation commands may also need tools such as:

```yaml
allowed-tools: Read Glob Grep LS Write Edit MultiEdit Bash
```

Use `node scripts/lint-frontmatter.mjs` to validate frontmatter shape, command descriptions, command/skill mappings, required skill sections, safety preflight references, and naming. When adding, removing, or renaming commands or skills, also confirm the paired command and skill files exist on both sides of the one-to-one mapping.

Command documentation normally lives under `nova-plugin/docs/commands/<stage>/`. Codex commands are the explicit exception: `codex-review-fix`, `codex-review-only`, and `codex-verify-only` are documented together under `nova-plugin/docs/commands/codex/` because their review/fix/verify loop crosses workflow stages. Each command still needs `<id>.md`, `<id>.README.md`, and `<id>.README.en.md`.

### Command System

| Stage | Commands | Purpose |
| --- | --- | --- |
| Explore | `senior-explore`, `explore`, `explore-lite`, `explore-review` | Understanding, fact gathering, and review-oriented exploration |
| Plan | `plan-lite`, `plan-review`, `produce-plan`, `backend-plan` | Lightweight planning, formal planning, and Java/Spring backend planning |
| Review | `review`, `review-lite`, `review-only`, `review-strict`, `codex-review-only`, `codex-verify-only` | Human review entry points and Codex-based verification |
| Implement | `implement-plan`, `implement-standard`, `implement-lite`, `codex-review-fix` | Plan-based implementation, standard implementation, lightweight implementation, and Codex-driven fix loops |
| Finalize | `finalize-work`, `finalize-lite` | Delivery summaries and handoff |

`/explore` is the unified exploration entry point. It routes by `PERSPECTIVE=observer|reviewer`.

`/review` is the unified review entry point. It adjusts review depth by `LEVEL=lite|standard|strict`.

The Codex command set:

- `codex-review-only`: runs Codex review only and writes a structured review artifact.
- `codex-review-fix`: runs review -> Claude Code fix -> local checks -> Codex verify.
- `codex-verify-only`: verifies against existing review and checks artifacts.

### Active Agents and Capability Packs

Active agents live in `nova-plugin/agents/`. The current active set is fixed at 6 core agents:

```text
architect
builder
orchestrator
publisher
reviewer
verifier
```

`orchestrator` decomposes work, chooses core agents and capability packs, and summarizes results. It does not implement directly. See `docs/agents/ROUTING.md` and `docs/agents/PLUGIN_AWARE_ROUTING.md` for routing rules.

Capability packs live in `nova-plugin/packs/`. They are documentation-only domain packs for `java`, `security`, `dependency`, `docs`, `release`, `marketplace`, `frontend`, and `mcp`. Packs must describe enhanced mode and fallback mode because installed plugins are optional accelerators, not hard dependencies.

The former active specialist set is mapped to the core model in `docs/agents/CORE_AGENTS_MIGRATION.md`.

`scripts/verify-agents.sh` and `scripts/verify-agents.ps1` check both the count and the exact expected 6-file set. `scripts/validate-packs.mjs` checks the pack inventory, required sections, and plugin-aware routing references. If an active agent or pack is added, removed, or renamed, update:

- `nova-plugin/agents/`
- `nova-plugin/packs/`
- `scripts/verify-agents.sh`
- `scripts/verify-agents.ps1`
- `scripts/validate-packs.mjs`
- `docs/agents/ROUTING.md`
- `docs/agents/PLUGIN_AWARE_ROUTING.md`
- `docs/agents/CORE_AGENTS_MIGRATION.md`, when routing compatibility changes
- `docs/agents/MIGRATION_MANIFEST.md`, if an archive migration is involved
- `CLAUDE.md`
- `AGENTS.md`

Legacy agents are archived under `.claude/agents/archive/nova-plugin/agents/`. They are not part of the `nova-plugin/agents/` active set. If Claude Code scans `.claude/**` and context token usage rises, follow the mitigation note printed by the `verify-agents` scripts.

### Hooks

`nova-plugin/hooks/hooks.json` currently enables:

- `PreToolUse`: matches `Write|Edit|MultiEdit` and runs `hooks/scripts/pre-write-check.sh` through Bash.
- `PostToolUse`: matches `Write|Edit|MultiEdit|Bash` and asynchronously runs `hooks/scripts/post-audit-log.sh` through Bash.

These scripts rely on `CLAUDE_PLUGIN_ROOT` to locate the plugin root. Hook commands should invoke `.sh` files explicitly through Bash unless the scripts are deliberately tracked with a Unix executable bit. When changing hook behavior, check timeout settings and cross-platform impact.

Hook scripts are Bash scripts. On Windows, they may require Git Bash, WSL, or another Bash-compatible runtime.

## Change Guidelines

### Modify an Existing Command

1. Edit `nova-plugin/commands/<id>.md`.
2. Update `nova-plugin/skills/nova-<id>/SKILL.md`.
3. If user-facing documentation changes, update `nova-plugin/docs/commands/<stage>/<id>.md`, the relevant README, or `nova-plugin/skills/README.md`. For Codex commands, use `nova-plugin/docs/commands/codex/`.
4. If behavior, parameters, outputs, tool permissions, or safety boundaries change, update `CHANGELOG.md` and decide whether a version bump is required. If a version bump is required, follow the Modify Plugin Metadata or Version workflow below.
5. Run `node scripts/lint-frontmatter.mjs`.

### Add a New Command and Skill

Every new command must have a matching skill:

```text
nova-plugin/commands/<id>.md
nova-plugin/skills/nova-<id>/SKILL.md
```

Also update:

- `nova-plugin/skills/README.md`
- the command overview or version notes in `README.md`
- `CHANGELOG.md`
- `nova-plugin/.claude-plugin/plugin.json` `version`
- `.claude-plugin/registry.source.json` plugin registry metadata, including `last-updated`
- generated `.claude-plugin/marketplace.json` plugin `version`
- generated `.claude-plugin/marketplace.metadata.json` plugin `version` and `last-updated`
- generated `docs/marketplace/catalog.md` plugin version and metadata evidence
- `CLAUDE.md`, if quick facts, command counts, workflows, or constraints changed
- `AGENTS.md`, if agent-facing facts, command counts, workflows, or constraints changed
- `nova-plugin/docs/commands/<stage>/<id>.md`, `<id>.README.md`, and `<id>.README.en.md`; use `nova-plugin/docs/commands/codex/` for Codex commands

After adding a command, run:

```bash
node scripts/validate-all.mjs
```

On Windows PowerShell:

```powershell
node scripts/validate-all.mjs
```

### Modify Plugin Metadata or Version

Version information is generated from:

- `nova-plugin/.claude-plugin/plugin.json` `version`
- `.claude-plugin/registry.source.json` plugin registry metadata, including `last-updated`
- generated `.claude-plugin/marketplace.json` plugin `version`
- generated `.claude-plugin/marketplace.metadata.json` plugin `version` and `last-updated`
- generated `docs/marketplace/catalog.md` plugin version and metadata evidence
- `CHANGELOG.md`
- `CLAUDE.md`, if quick facts, counts, constraints, or workflows changed
- `AGENTS.md`, if agent-facing facts, counts, constraints, or workflows changed

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

Release tags must use `v<plugin-version>` and match `nova-plugin/.claude-plugin/plugin.json` exactly; the release workflow rejects mismatched tags.

### Modify Agents

- Active agents belong only in `nova-plugin/agents/`.
- Archived or legacy agents belong under `.claude/agents/archive/`.
- If the active set changes, use the complete update list in the Active Agents section: agent files, both `verify-agents` scripts, routing docs, migration notes when relevant, `CLAUDE.md`, and `AGENTS.md`.
- Agent frontmatter uses `name`, `description`, and `tools`. Keep bodies short and route-focused.

## Quality Gates

Run only the checks that match the area you changed. Use the full pre-release block when a change crosses multiple areas, affects release metadata, or changes workflow behavior.

Metadata or marketplace changes:

```bash
node scripts/generate-registry.mjs --write
node scripts/validate-schemas.mjs
node scripts/validate-registry-fixtures.mjs
```

Command or skill contract/frontmatter changes:

```bash
node scripts/lint-frontmatter.mjs
```

Active agent changes:

```bash
bash scripts/verify-agents.sh
```

On Windows PowerShell:

```powershell
.\scripts\verify-agents.ps1
```

Capability pack changes:

```bash
node scripts/validate-packs.mjs
```

Hook config or hook script changes:

```bash
node scripts/validate-hooks.mjs
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

Documentation changes:

```bash
node scripts/validate-docs.mjs
```

This validates Markdown local links including anchors, command doc coverage and stage placement, release version/date sync from marketplace metadata, and non-archived report status.

For a full pre-release or broad workflow change, run all repository checks:

```bash
node scripts/validate-all.mjs
```

On Windows PowerShell, `validate-all.mjs` uses `.\scripts\verify-agents.ps1`. If Bash is unavailable, it warning-skips only the local `bash -n` hook syntax checks; CI/Linux still runs them.

Current CI includes verify-agents, validate-packs, validate-schemas, validate-registry-fixtures, validate-claude-compat, lint-frontmatter, validate-hooks, hook `bash -n`, and validate-docs.

## Do Not Edit

- Do not commit Codex runtime artifacts from `.codex/`, including timestamped `codex-review-fix` runs, `latest`, and `latest-artifacts/`.
- Do not edit archived agents under `.claude/agents/archive/` as if they were active agents; active agents live in `nova-plugin/agents/`.

## Key Constraints

- `commands/*.md` and `skills/nova-*/SKILL.md` must remain one-to-one.
- Each command must have three command docs in its workflow stage directory under `nova-plugin/docs/commands/`; Codex command docs are centralized under `nova-plugin/docs/commands/codex/`.
- `allowed-tools` must be a space-separated string, not a YAML array.
- `destructive-actions` must be one of `none`, `low`, `medium`, or `high`.
- `nova-plugin/agents/` must currently match the exact 6 core-agent file set expected by the verification scripts.
- `nova-plugin/packs/` must contain exactly the 8 documented capability packs, and each pack README must include enhanced mode and fallback mode.
- User-facing behavior changes require documentation and `CHANGELOG.md` updates.
- `.claude-plugin/marketplace.json`, `.claude-plugin/marketplace.metadata.json`, and `docs/marketplace/catalog.md` are generated outputs; update `plugin.json` or `registry.source.json`, then run `node scripts/generate-registry.mjs --write`.
- Review and Explore commands should not modify project code. Non-implement commands may declare `Write` or `Edit` only for explicit artifacts such as analysis, plan, review, or verify files. Implement commands are project-code write-capable when declared with write tools. Within the Codex set, only `codex-review-fix` should modify project files; `codex-review-only` and `codex-verify-only` should only create review or verify artifacts.

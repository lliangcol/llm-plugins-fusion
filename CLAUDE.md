# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Purpose

**LLM Plugins Fusion** is a third-party plugin marketplace and plugin collection for LLM coding assistants. The current primary plugin is `nova-plugin`, which is compatible with Claude Code and provides an engineering workflow that spans Explore -> Plan -> Review -> Implement -> Finalize.

## Quick Facts

- Marketplace entry: `.claude-plugin/marketplace.json`
- Marketplace custom metadata: `.claude-plugin/marketplace.metadata.json`
- Main plugin metadata: `nova-plugin/.claude-plugin/plugin.json`
- Plugin version source of truth: `nova-plugin/.claude-plugin/plugin.json`
- Current command snapshot: 20 files under `nova-plugin/commands/*.md`; validate frontmatter with `node scripts/lint-frontmatter.mjs`.
- Current skill snapshot: 20 files under `nova-plugin/skills/nova-*/SKILL.md`; validate frontmatter with `node scripts/lint-frontmatter.mjs`.
- Command docs: each command must have `<id>.md`, `<id>.README.md`, and `<id>.README.en.md` under `nova-plugin/docs/commands/**/`; validate with `node scripts/validate-docs.mjs`.
- Shared skill policies: `nova-plugin/skills/_shared/*.md`.
- Current active agent snapshot: 14 files under `nova-plugin/agents/*.md`; verify with `bash scripts/verify-agents.sh` or `.\scripts\verify-agents.ps1`.
- Repository validation scripts require Node.js 20+. Hook shell syntax checks require Bash; Windows without Bash may warning-skip local `bash -n`, while CI/Linux must run it.

## Sources of Truth

- Plugin version: `nova-plugin/.claude-plugin/plugin.json`, mirrored in `.claude-plugin/marketplace.json` and `.claude-plugin/marketplace.metadata.json`.
- Marketplace-only custom status fields, including `last-updated`, live in `.claude-plugin/marketplace.metadata.json`.
- Command definitions: `nova-plugin/commands/*.md`.
- Skill definitions: `nova-plugin/skills/nova-*/SKILL.md`.
- Command documentation: `nova-plugin/docs/commands/`.
- Shared command/skill policies: `nova-plugin/skills/_shared/`.
- Active agent set: `nova-plugin/agents/`, enforced by `scripts/verify-agents.sh` and `scripts/verify-agents.ps1`.
- Marketplace, marketplace metadata, and plugin schema contracts: `schemas/marketplace.schema.json`, `schemas/marketplace-metadata.schema.json`, and `schemas/plugin.schema.json`.

## Repository Layout

```text
claude-plugins-fusion/
|-- .claude-plugin/
|   |-- marketplace.json              # Plugin marketplace entry
|   `-- marketplace.metadata.json     # Repository-local marketplace metadata
|-- .github/workflows/
|   |-- ci.yml                        # Agent, schema, and frontmatter checks
|   `-- release.yml                   # Tag-based release and release notes
|-- docs/
|   `-- agents/                       # Active agent routing and migration notes
|-- nova-plugin/
|   |-- .claude-plugin/plugin.json    # nova-plugin metadata and version
|   |-- commands/                     # 20 Claude Code command definitions
|   |-- skills/                       # 20 Agent Skills mapped one-to-one with commands
|   |-- agents/                       # 14 default active agents
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
node scripts/validate-schemas.mjs
node scripts/validate-claude-compat.mjs
node scripts/lint-frontmatter.mjs
bash scripts/verify-agents.sh
node scripts/validate-hooks.mjs
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
node scripts/validate-docs.mjs
```

Repository-level checks on Windows PowerShell:

```powershell
node scripts/validate-schemas.mjs
node scripts/validate-claude-compat.mjs
node scripts/lint-frontmatter.mjs
.\scripts\verify-agents.ps1
node scripts/validate-hooks.mjs
node scripts/validate-docs.mjs
node scripts/validate-all.mjs
```

If Bash is not installed on Windows, `node scripts/validate-all.mjs` warns and skips the local `bash -n` hook syntax checks. Do not report those syntax checks as locally passed unless Bash actually ran them.

## Architecture

### Plugin Discovery

- `.claude-plugin/marketplace.json` registers installable plugins.
- `nova-plugin/.claude-plugin/plugin.json` declares plugin name, version, author, license, keywords, homepage, and repository metadata. Claude-compatible marketplace display fields such as category and tags live in `.claude-plugin/marketplace.json`; repository-local trust/risk/deprecation and `last-updated` metadata lives in `.claude-plugin/marketplace.metadata.json`.
- `nova-plugin/commands/*.md` contains Claude Code command definitions.
- `nova-plugin/skills/nova-*/SKILL.md` contains Agent Skill definitions discovered by directory convention.
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

### Active Agents

Active agents live in `nova-plugin/agents/`. The current active set is fixed at 14 agents:

```text
api-design
build-deps
data-analytics
db-engineer
devops-platform
git-release-manager
incident-responder
java-backend-engineer
orchestrator
quality-engineer
refactoring-specialist
security-audit
security-engineer
test-automator
```

`orchestrator` only decomposes, routes, and summarizes work. It does not implement directly. See `docs/agents/ROUTING.md` for detailed routing rules.

`scripts/verify-agents.sh` and `scripts/verify-agents.ps1` check both the count and the exact expected 14-file set. If an active agent is added, removed, or renamed, update:

- `nova-plugin/agents/`
- `scripts/verify-agents.sh`
- `scripts/verify-agents.ps1`
- `docs/agents/ROUTING.md`
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
- `.claude-plugin/marketplace.json` plugin `version`
- `.claude-plugin/marketplace.metadata.json` plugin `version` and `last-updated`
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

Version information must stay synchronized across:

- `nova-plugin/.claude-plugin/plugin.json` `version`
- `.claude-plugin/marketplace.json` plugin `version`
- `.claude-plugin/marketplace.metadata.json` plugin `version` and `last-updated`
- `CHANGELOG.md`
- `CLAUDE.md`, if quick facts, counts, constraints, or workflows changed
- `AGENTS.md`, if agent-facing facts, counts, constraints, or workflows changed

Versioning follows SemVer:

- MAJOR: command deletion, command rename, or incompatible behavior changes.
- MINOR: new command, skill, agent, or significant capability expansion.
- PATCH: bug fix, documentation update, internal refactor, or metadata correction.

After metadata or schema changes, run:

```bash
node scripts/validate-schemas.mjs
node scripts/validate-claude-compat.mjs
```

### Modify Agents

- Active agents belong only in `nova-plugin/agents/`.
- Archived or legacy agents belong under `.claude/agents/archive/`.
- If the active set changes, use the complete update list in the Active Agents section: agent files, both `verify-agents` scripts, routing docs, migration notes when relevant, `CLAUDE.md`, and `AGENTS.md`.
- Agent frontmatter uses `name`, `description`, and `tools`. Keep bodies short and route-focused.

## Quality Gates

Run only the checks that match the area you changed. Use the full pre-release block when a change crosses multiple areas, affects release metadata, or changes workflow behavior.

Metadata or marketplace changes:

```bash
node scripts/validate-schemas.mjs
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

Current CI includes verify-agents, validate-schemas, lint-frontmatter, validate-hooks, hook `bash -n`, and validate-docs.

## Do Not Edit

- Do not commit Codex runtime artifacts from `.codex/`, including timestamped `codex-review-fix` runs, `latest`, and `latest-artifacts/`.
- Do not edit archived agents under `.claude/agents/archive/` as if they were active agents; active agents live in `nova-plugin/agents/`.

## Key Constraints

- `commands/*.md` and `skills/nova-*/SKILL.md` must remain one-to-one.
- Each command must have three command docs in its workflow stage directory under `nova-plugin/docs/commands/`; Codex command docs are centralized under `nova-plugin/docs/commands/codex/`.
- `allowed-tools` must be a space-separated string, not a YAML array.
- `destructive-actions` must be one of `none`, `low`, `medium`, or `high`.
- `nova-plugin/agents/` must currently match the exact 14-file set expected by the verification scripts.
- User-facing behavior changes require documentation and `CHANGELOG.md` updates.
- Review and Explore commands should not modify project code. Non-implement commands may declare `Write` or `Edit` only for explicit artifacts such as analysis, plan, review, or verify files. Implement commands are project-code write-capable when declared with write tools. Within the Codex set, only `codex-review-fix` should modify project files; `codex-review-only` and `codex-verify-only` should only create review or verify artifacts.

English | [中文](../../../README.md)

<div align="center">

# LLM Plugins Fusion

**A public multi-project AI engineering workflow framework with `nova-plugin`, consumer profile contracts, and redacted templates**

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/lliangcol/llm-plugins-fusion)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](../../../LICENSE)

</div>

---

## Positioning

`llm-plugins-fusion` is a public multi-project AI engineering workflow framework for LLM coding assistants. Its primary deliverable is `nova-plugin`, distributed through the Claude Code marketplace format, and it covers the engineering loop from discovery to handoff:

```text
Explore -> Plan -> Review -> Implement -> Finalize
```

The repository can support private consumer projects, but public content should only contain generic workflows, consumer profile contracts, redacted Java backend/frontend templates, and general capability pack guidance. Real consumer profiles belong in the consumer project's own `AGENTS.md`, `CLAUDE.md`, `.claude/`, or private docs.

Marketplace metadata is the current installation and distribution mechanism; this repository should not be described as a mature multi-plugin ecosystem or as already having a public portal.

It serves three audiences:

| Audience | Needs | Start here |
| --- | --- | --- |
| Consumer maintainers | Adopt the generic workflow, maintain private profiles, choose validation boundaries | [Consumer profiles](../../../docs/consumers/README.md), [Examples](../../../docs/examples/README.md), [Command Map](#command-map) |
| Plugin users | Install `nova-plugin`, pick commands, copy usage templates | [Quick Start](#quick-start), [Command Map](#command-map), [docs index](../README.md) |
| Plugin authors | Add commands / skills and understand frontmatter contracts | [CONTRIBUTING.md](../../../CONTRIBUTING.md), [Skill-first design](../architecture/dual-track-design.md) |
| Maintainers | Schema, CI, validation, release, and safety boundaries | [Quality Gates](#quality-gates), [SECURITY.md](../../../SECURITY.md), [CHANGELOG.md](../../../CHANGELOG.md) |

## Current Status

<table>
<tr>
<td><strong>Plugin version</strong></td>
<td>2.1.0</td>
</tr>
<tr>
<td><strong>Main plugin</strong></td>
<td><code>nova-plugin</code></td>
</tr>
<tr>
<td><strong>Commands / Skills</strong></td>
<td>20 commands, 20 one-to-one skills</td>
</tr>
<tr>
<td><strong>Active agents</strong></td>
<td>6 core agents in <code>nova-plugin/agents/</code>; 8 capability packs in <code>nova-plugin/packs/</code></td>
</tr>
<tr>
<td><strong>License</strong></td>
<td>MIT</td>
</tr>
</table>

The validation suite covers schemas, registry fixtures, Claude compatibility, command / skill frontmatter, core agent inventory, capability pack structure, hooks, Markdown local links, command documentation coverage, and generated catalog drift.

```bash
node scripts/validate-all.mjs
```

On Windows without Bash, `validate-all` warns and skips local `bash -n` hook syntax checks. CI/Linux still runs those checks and must pass.

## Quick Start

### Prerequisites

- Claude Code plugin marketplace access with third-party marketplace support.
- Regular `nova-plugin` commands require only the installed plugin.
- Codex loop commands require a locally callable Codex CLI and Bash for the skill scripts.
- Repository maintenance and local validation require Node.js 20+.

### Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add lliangcol/llm-plugins-fusion
```

Install the plugin:

```bash
/plugin install nova-plugin@llm-plugins-fusion
```

Confirm installation:

```bash
/plugin
```

Start using it:

```bash
/explore analyze the current project structure and main risks
```

Private consumer projects should maintain their own project-local profile before running the workflow. The public contract is in [docs/consumers/](../../../docs/consumers/README.md).

## Command Map

New users and consumer profiles should default to the five main entries: `/explore`, `/produce-plan`, `/review`, `/implement-plan`, and `/finalize-work`. Other commands remain available as advanced or compatibility entries without behavior changes.

| Stage | Goal | Main entry | Advanced / compatibility entries |
| --- | --- | --- | --- |
| Explore | Understand the problem, gather facts, expose uncertainty | `/explore` | `/senior-explore`, `/explore-lite`, `/explore-review` |
| Plan | Produce an implementation plan or design document | `/produce-plan` | `/plan-lite`, `/plan-review`, `/backend-plan` |
| Review | Review code, plans, or branch risk | `/review` | `/review-lite`, `/review-only`, `/review-strict`, `/codex-review-only`, `/codex-verify-only` |
| Implement | Execute an approved plan | `/implement-plan` | `/implement-standard`, `/implement-lite`, `/codex-review-fix` |
| Finalize | Summarize delivery, risks, verification, and follow-ups | `/finalize-work` | `/finalize-lite` |

Common path:

```text
/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
```

Codex loop path:

```text
/codex-review-only -> fix -> /codex-verify-only
```

Or use the semi-automated loop:

```text
/codex-review-fix
```

## Core Agents + Packs

`nova-plugin` now uses 6 short, route-focused core agents for general responsibilities and 8 capability packs for domain rules. Packs are first-phase documentation-only capability bundles; they do not implement runtime dynamic loading. Installed plugins are enhanced mode only, and each pack must also define fallback mode.

| Core agent | Responsibility |
| --- | --- |
| `orchestrator` | Decompose work, choose agent + pack, merge results, identify missing inputs |
| `architect` | Architecture, boundaries, risks, migration plans, technical decisions |
| `builder` | Implementation, refactoring, integration, scoped project edits |
| `reviewer` | Code, design, security, and quality review with prioritized findings |
| `verifier` | Tests, static checks, dependency security, CI/local validation |
| `publisher` | README, docs, CHANGELOG, release notes, handoff |

Capability packs: `java`, `security`, `dependency`, `docs`, `release`, `marketplace`, `frontend`, `mcp`.

## Repository Contents

```text
llm-plugins-fusion/
|-- .claude-plugin/
|   |-- registry.source.json          # registry generation input
|   |-- marketplace.json              # generated Claude marketplace entry
|   `-- marketplace.metadata.json     # generated repository-local trust/risk/maintainer/evidence metadata
|-- nova-plugin/
|   |-- .claude-plugin/plugin.json    # plugin metadata and version source
|   |-- commands/                     # 20 slash command thin wrappers
|   |-- skills/                       # 20 nova-* skills + _shared policies
|   |-- agents/                       # 6 core active agents
|   |-- packs/                        # 8 capability pack docs
|   |-- docs/                         # user docs, command docs, architecture, history
|   `-- hooks/                        # Claude Code hook config and scripts
|-- docs/
|   |-- agents/                       # core agent routing, plugin-aware routing, and migration manifest
|   |-- consumers/                    # consumer profile contract and redacted templates
|   |-- examples/                     # redacted Java backend / frontend workflow examples
|   |-- marketplace/                  # catalog, author workflow, compatibility, trust, and review docs
|   |-- releases/                     # release decisions, runbook, and hygiene docs
|   `-- reports/archive/              # historical audit reports
|-- fixtures/                         # registry multi-entry fixture
|-- schemas/                          # registry source / marketplace / metadata / plugin schemas
|-- scripts/                          # local and CI validation scripts
|-- README.md
|-- CONTRIBUTING.md
|-- CHANGELOG.md
|-- ROADMAP.md
`-- SECURITY.md
```

## Documentation

| Document | Contents | Use case |
| --- | --- | --- |
| [nova-plugin docs index](../README.md) | Docs structure, command coverage, maintenance rules | First navigation point |
| [Consumer profile templates](../../../docs/consumers/README.md) | Multi-project consumer profile contract and redacted Java backend / frontend templates | Private project adoption |
| [Redacted examples](../../../docs/examples/README.md) | Redacted Java backend and frontend workflow examples | Writing private profiles or handoff templates |
| [Command Reference Guide](../guides/commands-reference-guide.en.md) | Parameters, examples, workflow templates | Daily command lookup |
| [Command Handbook](../guides/claude-code-commands-handbook.en.md) | Command selection and copy-ready usage | Quick start |
| [Codex Loop Guide](../commands/codex/codex-review-fix.README.en.md) | review / fix / verify collaboration | Claude Code + Codex |
| [Skill-first design](../architecture/dual-track-design.md) | Command and skill responsibilities | Changing commands or skills |
| [Hooks design](../architecture/hooks-design.md) | Pre-write checks and audit hooks | Maintaining safety boundaries |
| [Core agent routing](../../../docs/agents/ROUTING.md) | Routing rules for 6 core agents and capability packs | Choosing or maintaining agents |
| [Plugin-aware routing](../../../docs/agents/PLUGIN_AWARE_ROUTING.md) | Enhanced / fallback mode and pack activation rules | Maintaining pack routing |
| [Marketplace catalog](../../../docs/marketplace/catalog.md) | Generated plugin catalog and compatibility evidence | Browsing marketplace entries |
| [Marketplace portal IA](../../../docs/marketplace/portal-information-architecture.md) | Marketplace portal information architecture, data sources, and vNext / v2.0.0 / v2.1.0 / v2.2.0 / v3.0.0 boundaries | Evaluating the deferred portal boundary |
| [v3 readiness evidence](../../../docs/marketplace/v3-readiness-evidence.md) | Evidence ledger for whether multi-plugin directories or a public portal should start | Evaluating whether v3.0.0 should move into planning |
| [Registry author workflow](../../../docs/marketplace/registry-author-workflow.md) | Plugin entry updates, scaffold dry-run, profiles, and validation flow | Plugin authors and maintainers |
| [Compatibility matrix](../../../docs/marketplace/compatibility-matrix.md) | Claude Code, Codex CLI, Bash, Node.js, and optional enhanced tools | Reviewing compatibility |
| [Trust policy](../../../docs/marketplace/trust-policy.md) | Trust/risk/deprecation/last-updated/maintainer semantics and review requirements | Reviewing marketplace metadata |
| [Security review route](../../../docs/marketplace/security-review-route.md) | Security-sensitive plugin change route and minimum checks | Security review |
| [Release hygiene](../../../docs/releases/release-hygiene.md) | Tag/version sync, generated drift, changelog, and pre-release review | Release preparation |
| [vNext release decision](../../../docs/releases/vnext-release-decision.md) | vNext release level and compatibility matrix | Release decision |
| [Capability packs](../../packs/README.md) | Index for 8 domain capability packs | Maintaining packs |
| [Legacy agents summary](../agents/agents-summary.en.md) | Historical legacy agent roles | Inspecting old design |

## Maintenance

Version and registry sources:

- `nova-plugin/.claude-plugin/plugin.json`: plugin metadata and version source
- `.claude-plugin/registry.source.json`: registry, marketplace display fields, and trust/risk/maintainer/evidence metadata source
- `.claude-plugin/marketplace.json`: generated Claude marketplace manifest
- `.claude-plugin/marketplace.metadata.json`: generated repository-local metadata
- `docs/marketplace/catalog.md`: generated Markdown catalog
- `CHANGELOG.md`

Commands and skills must stay one-to-one:

```text
nova-plugin/commands/<id>.md
nova-plugin/skills/nova-<id>/SKILL.md
```

Each command must have three command docs:

```text
nova-plugin/docs/commands/<stage>/<id>.md
nova-plugin/docs/commands/<stage>/<id>.README.md
nova-plugin/docs/commands/<stage>/<id>.README.en.md
```

Codex command docs live in `nova-plugin/docs/commands/codex/`; this is the explicit exception to the stage-directory rule.

## Quality Gates

Full validation:

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
node scripts/validate-packs.mjs
node scripts/validate-hooks.mjs
node scripts/validate-docs.mjs
```

Agent check:

```bash
bash scripts/verify-agents.sh
```

Windows PowerShell:

```powershell
.\scripts\verify-agents.ps1
```

Pack check:

```bash
node scripts/validate-packs.mjs
```

Hook shell syntax checks require Bash:

```bash
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

## Contributing

Read [CONTRIBUTING.md](../../../CONTRIBUTING.md) before opening a PR. Report security issues privately using [SECURITY.md](../../../SECURITY.md). See [ROADMAP.md](../../../ROADMAP.md) for planned work.

## License

This project is licensed under the [MIT License](../../../LICENSE).

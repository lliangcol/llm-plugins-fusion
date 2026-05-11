English | [中文](../../../README.md)

<div align="center">

# LLM Plugins Fusion

**A public multi-project AI engineering workflow framework with `nova-plugin`, consumer profile contracts, and redacted templates**

[![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)](https://github.com/lliangcol/llm-plugins-fusion)
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

It serves these audiences:

| Audience | Needs | Start here |
| --- | --- | --- |
| Consumer maintainers | Adopt the generic workflow, maintain private profiles, choose validation boundaries | [Consumer profiles](../../../docs/consumers/README.md), [Examples](../../../docs/examples/README.md), [Command Map](#command-map) |
| Plugin users | Install `nova-plugin`, pick commands, copy usage templates | [Quick Start](#quick-start), [Command Map](#command-map), [docs index](../README.md) |
| Plugin authors | Add commands / skills and understand frontmatter contracts | [CONTRIBUTING.md](../../../CONTRIBUTING.md), [Skill-first design](../architecture/dual-track-design.md) |
| Maintainers | Schema, CI, validation, release, and safety boundaries | [Quality Gates](#quality-gates), [SECURITY.md](../../../SECURITY.md), [CHANGELOG.md](../../../CHANGELOG.md) |

Use it when:

- You already use Claude Code and want a stable explore / plan / review /
  implement / finalize workflow for AI-assisted engineering.
- You maintain multiple projects and want public workflow guidance while keeping
  real consumer profiles in private project repositories.
- You want schema, frontmatter, documentation, and release checks to reduce
  plugin maintenance drift.

It is not ready for:

- A mature multi-plugin marketplace, public portal, paid distribution, or hosted
  registry.
- A standalone runtime automation platform beyond Claude Code commands and
  skills.
- Publishing real closed-source project configuration, endpoints, credentials,
  or private knowledge base content.

## Current Status

<table>
<tr>
<td><strong>Plugin version</strong></td>
<td>2.2.0</td>
</tr>
<tr>
<td><strong>Main plugin</strong></td>
<td><code>nova-plugin</code></td>
</tr>
<tr>
<td><strong>Commands / Skills</strong></td>
<td>21 commands, 21 one-to-one skills</td>
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

The default validation suite covers schemas, registry fixtures, Claude compatibility, command / skill frontmatter, core agent inventory, capability pack structure, hooks, Codex Bash runtime smoke, distribution risk scanning, Markdown local links, command documentation coverage, and generated catalog drift. CI also runs Claude plugin install smoke testing.

```bash
node scripts/validate-all.mjs
```

On Windows without Bash, `validate-all` warns and skips local Bash-dependent hook syntax and runtime smoke checks. CI/Linux still runs those checks and must pass.

## Stable Promotion Boundary

Promote formal release tags such as `v2.2.0`, not a moving `main` branch.
Current `main` may contain follow-up work under `CHANGELOG.md` `Unreleased`,
so it should be described as an unreleased development snapshot until tagged.

Before promoting a release, record the target commit, exact tag,
`node scripts/validate-all.mjs`, `git diff --check`, Bash hook syntax checks,
Codex runtime smoke, distribution risk scan, and skipped checks with the
[release evidence template](../../../docs/releases/release-evidence-template.md).
If Windows local validation reports skipped checks because Bash is not
available, describe that exactly and rely on CI/Linux evidence for the Bash
checks.

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

If you are not sure which command should start:

```bash
/route This task touches docs, versioning, and install validation; recommend the next nova workflow step
```

Private consumer projects should maintain their own project-local profile before running the workflow. The public contract is in [docs/consumers/](../../../docs/consumers/README.md).

### Default Workflow

```text
/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
```

| Current goal | Default command | Notes |
| --- | --- | --- |
| Understand the problem without solutions | `/explore` | Gather facts, uncertainties, and risk signals only. |
| Produce a reviewable plan | `/produce-plan` | Write a formal plan for review and implementation. |
| Review plans, code, or risk | `/review` | Defaults to standard depth; use `LEVEL=lite|strict` to adjust. |
| Implement an approved plan | `/implement-plan` | Requires a clear plan and `PLAN_APPROVED=true`. |
| Summarize delivery and follow-ups | `/finalize-work` | Freeze state and write delivery notes without expanding scope. |

Minimal copyable examples:

| Command | Example |
| --- | --- |
| `/explore` | `/explore summarize facts, uncertainties, and risks for this requirement; no solutions` |
| `/produce-plan` | `/produce-plan PLAN_OUTPUT_PATH=docs/plans/example.md PLAN_INTENT="write a reviewable plan for the confirmed requirement"` |
| `/review` | `/review LEVEL=standard review this plan or diff and return severity-ranked findings` |
| `/implement-plan` | `/implement-plan PLAN_INPUT_PATH=docs/plans/example.md PLAN_APPROVED=true` |
| `/finalize-work` | `/finalize-work summarize completed changes, validation, limitations, and follow-ups` |

## Command Map

New users and consumer profiles should default to the five main entries: `/explore`, `/produce-plan`, `/review`, `/implement-plan`, and `/finalize-work`. Use read-only `/route` first when the right entry point is unclear. Other commands remain available as advanced or compatibility entries without behavior changes.

| Stage | Goal | Main entry | Advanced / compatibility entries |
| --- | --- | --- | --- |
| Explore | Choose an entry point, understand the problem, gather facts, expose uncertainty | `/route`, `/explore` | `/senior-explore`, `/explore-lite`, `/explore-review` |
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

Codex commands are an advanced path. They require a locally callable Codex CLI
and Bash for the distributed skill scripts. The ordinary five-stage workflow
does not require Codex CLI.

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

## Five-Layer Architecture

`nova-plugin` can be maintained as five layers: rules and memory, skill behavior contracts, deterministic guardrails, core-agent delegation, and marketplace distribution. See [Agent Development Stack](../architecture/agent-development-stack.md) for the full model.

| Layer | Current sources | Maintenance focus |
| --- | --- | --- |
| Memory | `AGENTS.md`, `CLAUDE.md`, `docs/consumers/` | Repository rules, consumer profile boundaries, public/private information separation |
| Skills | `nova-plugin/skills/`, `nova-plugin/commands/` | One-to-one command / skill mapping, parameters, safety boundaries, and output contracts |
| Guardrails | `nova-plugin/hooks/`, `scripts/validate-*.mjs` | Deterministic hooks, schema, frontmatter, docs, and release validation |
| Delegation | `nova-plugin/agents/`, `nova-plugin/packs/` | 6 core agents, 8 capability packs, enhanced / fallback routing |
| Distribution | `.claude-plugin/`, `nova-plugin/.claude-plugin/plugin.json` | Marketplace metadata, generated catalog, and install boundary |

## Repository Contents

```text
llm-plugins-fusion/
|-- .claude-plugin/
|   |-- registry.source.json          # registry generation input
|   |-- marketplace.json              # generated Claude marketplace entry
|   `-- marketplace.metadata.json     # generated repository-local trust/risk/maintainer/evidence metadata
|-- nova-plugin/
|   |-- .claude-plugin/plugin.json    # plugin metadata and version source
|   |-- commands/                     # 21 slash command thin wrappers
|   |-- skills/                       # 21 nova-* skills + _shared policies
|   |-- agents/                       # 6 core active agents
|   |-- packs/                        # 8 capability pack docs
|   |-- docs/                         # user docs, command docs, architecture, history
|   `-- hooks/                        # Claude Code hook config and scripts
|-- docs/
|   |-- README.md                     # repository-level documentation index
|   |-- agents/                       # core agent routing, plugin-aware routing, and migration manifest
|   |-- consumers/                    # consumer profile contract and redacted templates
|   |-- examples/                     # redacted Java backend / frontend workflow examples
|   |-- marketplace/                  # catalog, author workflow, compatibility, trust, and review docs
|   |-- prompts/                      # public-safe copyable prompt templates
|   |-- releases/                     # release decisions, runbook, and hygiene docs
|   |-- workflows/                    # context-safe agent workflow guidance
|   |-- project-optimization-plan.md   # current project optimization plan
|   `-- reports/                      # optimization reports and historical audit archive
|-- fixtures/                         # registry multi-entry fixture
|-- schemas/                          # registry source / marketplace / metadata / plugin schemas
|-- scripts/                          # local and CI validation scripts
|-- README.md
|-- AGENTS.md
|-- CLAUDE.md
|-- CODE_OF_CONDUCT.md
|-- CONTRIBUTING.md
|-- CHANGELOG.md
|-- ROADMAP.md
`-- SECURITY.md
```

## Documentation

| Document | Contents | Use case |
| --- | --- | --- |
| [Repository docs index](../../../docs/README.md) | `docs/` directory map, document inventory, and maintenance rules | Finding public repository docs |
| [nova-plugin docs index](../README.md) | Docs structure, command coverage, maintenance rules | First navigation point |
| [AGENTS.md](../../../AGENTS.md) | Repository rules for Codex and generic AI coding agents | Agent work in this repository |
| [CLAUDE.md](../../../CLAUDE.md) | Repository rules for Claude Code | Claude Code work in this repository |
| [CONTRIBUTING.md](../../../CONTRIBUTING.md) | PR, marketplace entry, and command/skill maintenance rules | Contributing or changing structure |
| [CHANGELOG.md](../../../CHANGELOG.md) | Version history and unreleased changes | Understanding version impact |
| [ROADMAP.md](../../../ROADMAP.md) | Roadmap, non-goals, and maintenance rules | Planning follow-up work |
| [SECURITY.md](../../../SECURITY.md) | Support range, vulnerability reporting, and disclosure policy | Security issue handling |
| [CODE_OF_CONDUCT.md](../../../CODE_OF_CONDUCT.md) | Contributor code of conduct | Community collaboration |
| [Consumer profile templates](../../../docs/consumers/README.md) | Multi-project consumer profile contract and redacted Java backend / frontend templates | Private project adoption |
| [Cursor setup](../../../docs/consumers/cursor-setup.md) | Consuming `nova-route` and core nova skills from Cursor rules | Non-Claude Code adoption |
| [Gemini CLI setup](../../../docs/consumers/gemini-cli-setup.md) | Consuming nova workflows from Gemini CLI context or skills | Non-Claude Code adoption |
| [OpenCode setup](../../../docs/consumers/opencode-setup.md) | OpenCode intent-to-skill routing and fallback notes | Non-Claude Code adoption |
| [Copilot setup](../../../docs/consumers/copilot-setup.md) | GitHub Copilot instructions and core-agent mapping | Non-Claude Code adoption |
| [Codex setup](../../../docs/consumers/codex-setup.md) | Codex Markdown skill consumption and Codex loop prerequisites | Codex / other agent adoption |
| [Workbench consumer template](../../../docs/consumers/workbench-template.md) | Private workspace structure, naming, checkpoint, and handoff rules | Long-running process assets |
| [Redacted examples](../../../docs/examples/README.md) | Redacted Java backend and frontend workflow examples | Writing private profiles or handoff templates |
| [Workflow evaluation examples](../../../docs/examples/workflow-evaluation.md) | Public-safe five-stage workflow examples, rubrics, and failure signals | Evaluating command output quality |
| [Context-safe workflows](../../../docs/workflows/context-safe-agent-workflows.md) | Review, fix, documentation, and handoff loops that avoid context blow-up | Large-task decomposition and resumability |
| [Prompt template library](../../../docs/prompts/README.md) | Codex, Claude Code, and delivery documentation prompt templates | Copying into private consumer projects |
| [Command Reference Guide](../guides/commands-reference-guide.en.md) | Parameters, examples, workflow templates | Daily command lookup |
| [Command Handbook](../guides/claude-code-commands-handbook.en.md) | Command selection and copy-ready usage | Quick start |
| [Codex Loop Guide](../commands/codex/codex-review-fix.README.en.md) | review / fix / verify collaboration | Claude Code + Codex |
| [Skill-first design](../architecture/dual-track-design.md) | Command and skill responsibilities | Changing commands or skills |
| [Hooks design](../architecture/hooks-design.md) | Pre-write checks and audit hooks | Maintaining safety boundaries |
| [Agent Development Stack](../architecture/agent-development-stack.md) | Five-layer architecture, source files, and validation gates | Understanding or maintaining the plugin stack |
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
| [Release evidence template](../../../docs/releases/release-evidence-template.md) | Environment, tag, validation, and skipped-check evidence before release or promotion | Release evidence capture |
| [vNext release decision](../../../docs/releases/vnext-release-decision.md) | vNext release level and compatibility matrix | Release decision |
| [Capability packs](../../packs/README.md) | Index for 8 domain capability packs | Maintaining packs |

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
node scripts/validate-plugin-install.mjs
node scripts/lint-frontmatter.mjs
node scripts/validate-packs.mjs
node scripts/validate-hooks.mjs
node scripts/validate-runtime-smoke.mjs
node scripts/scan-distribution-risk.mjs
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

Claude plugin install smoke requires the Claude CLI and attempts a user-scope
plugin install:

```bash
node scripts/validate-plugin-install.mjs
```

Codex runtime smoke and distribution risk checks:

```bash
node scripts/validate-runtime-smoke.mjs
node scripts/scan-distribution-risk.mjs
```

## Contributing

Read [CONTRIBUTING.md](../../../CONTRIBUTING.md) before opening a PR. Report security issues privately using [SECURITY.md](../../../SECURITY.md). See [ROADMAP.md](../../../ROADMAP.md) for planned work.

## License

This project is licensed under the [MIT License](../../../LICENSE).

English | [中文](../../../README.md)

<div align="center">

# LLM Plugins Fusion

**Make Claude Code follow an engineering loop: Explore -> Plan -> Review -> Implement -> Finalize.**

[![CI](https://github.com/lliangcol/llm-plugins-fusion/actions/workflows/ci.yml/badge.svg)](https://github.com/lliangcol/llm-plugins-fusion/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/lliangcol/llm-plugins-fusion?label=release)](https://github.com/lliangcol/llm-plugins-fusion/releases/latest)
[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](https://github.com/lliangcol/llm-plugins-fusion/releases/tag/v4.0.0)
[![License](https://img.shields.io/github/license/lliangcol/llm-plugins-fusion)](../../../LICENSE)

</div>

---

## 30-Second Summary

`llm-plugins-fusion` is a public AI engineering workflow framework for LLM coding assistants. Its current primary deliverable is `nova-plugin`, an installable Claude Code workflow plugin that turns ad hoc prompting into a reusable, reviewable, delivery-aware process with commands, skills, core agents, capability packs, and validation guardrails.

```text
Explore -> Plan -> Review -> Implement -> Finalize
```

Marketplace metadata is the current installation and distribution mechanism. This repository should not be described as a mature multi-plugin ecosystem, and the deferred public portal is not an implemented capability. Public content should contain only generic workflows, consumer profile contracts, redacted templates, prompt templates, and capability pack guidance. Real consumer profiles, endpoints, credentials, private knowledge, business rules, and private repository addresses belong in the consumer project's own `AGENTS.md`, `CLAUDE.md`, `.claude/`, or private docs.

## 3-Minute Install

Regular `nova-plugin` workflows only require the Claude Code plugin. Repository maintenance and local validation require Node.js 22+. Codex loop commands also require a locally callable Codex CLI and Bash.

```text
/plugin marketplace add lliangcol/llm-plugins-fusion@v4.0.0
/plugin install nova-plugin@llm-plugins-fusion
/nova-plugin:route This task touches docs, versioning, and install validation; recommend the next nova workflow step
```

Confirm installation:

```text
/plugin
```

After the first install, start with read-only `/nova-plugin:route`. It should recommend the next command, skill, core agent, capability packs, required inputs, validation path, and fallback mode.

Without a Claude Code environment, inspect the workflow contract through the
headless local demos:

```bash
npm run demo:route
npm run demo:review
```

Non-Claude users can consume command and skill Markdown as readable contracts;
do not assume Claude slash-command runtime behavior exists automatically in
other coding assistants.

## Who It Helps

| Audience | Start here | Goal |
| --- | --- | --- |
| Claude Code users | [Getting Started](../../../docs/getting-started/first-workflow.md) | Install `nova-plugin` and complete the first `/nova-plugin:route` workflow in minutes. |
| Non-Claude users | `npm run demo:route` / [Consumer setup](../../../docs/guides/assistants/README.md) | Understand the workflow with headless fixtures and Markdown contracts without assuming slash-command runtime support. |
| Consumer maintainers | [Consumer profiles](../../../docs/guides/assistants/README.md) | Keep private project context local while reusing the public workflow contract. |
| Plugin authors | [CONTRIBUTING.md](../../../CONTRIBUTING.md) | Change commands or skills after reading the [skill-first design](../architecture/dual-track-design.md). |
| First-time contributors | [First contribution path](../../../CONTRIBUTING.md#第一次贡献路径) | Start with docs clarification, fixture updates, validator messages, or public-safe examples. |
| Maintainers | [Quality Gates](#quality-gates) | Run validation by change scope and record release evidence. |

## Showcase

| Scenario | Entry | What it demonstrates |
| --- | --- | --- |
| Java backend | [Java backend tutorial](../../../docs/tutorials/java-backend.md) | Turning a vague backend task into explore, plan, review, implement, and finalize evidence. |
| Frontend | [Frontend tutorial](../../../docs/tutorials/frontend.md) | Converting UI work into component, state, accessibility, and screenshot validation boundaries. |
| Release and docs | [Release and docs tutorial](../../../docs/tutorials/release-and-docs.md) | Handling release notes, docs sync, validation evidence, and residual risk. |

Demo capture guidance lives in [community asset guidance](../../../docs/operations/community/assets.md). Growth metric definitions live in [community metrics](../../../docs/operations/community/metrics.md).

## Security And Trust

- Write-capable, Bash, and external CLI flows must be constrained by explicit parameters, preflight checks, artifact scope, and validation evidence.
- Public docs must not contain real consumer profiles, endpoints, credentials, private repository addresses, business rules, or private knowledge-base content.
- The default local gate is `node scripts/validate-all.mjs`; Windows Bash-dependent warning-skips must be reported as skipped, not passed.
- Report security issues privately through [SECURITY.md](../../../SECURITY.md), not public issues.

## Current Status

<table>
<tr>
<td><strong>Stable plugin version</strong></td>
<td>4.0.0</td>
</tr>
<tr>
<td><strong>Main plugin</strong></td>
<td><code>nova-plugin</code></td>
</tr>
<tr>
<td><strong>Commands / Skills</strong></td>
<td>21 commands, 6 canonical skills</td>
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

The default validation suite covers schemas, registry fixtures, Claude compatibility, command / skill frontmatter, core agent inventory, capability pack structure, hooks, Codex Bash runtime smoke, distribution risk scanning, Markdown local links, command documentation coverage, and generated catalog drift. CI also previews the Claude plugin install path with a dry run; real user-scope install smoke belongs only in CI or an isolated test-user environment.

```bash
node scripts/validate-all.mjs
```

On Windows without Bash, `validate-all` warns and skips local Bash-dependent hook syntax and runtime smoke checks. CI/Linux still runs those checks and must pass.

## Stable Promotion Boundary

Promote formal release tags such as `v4.0.0`, not a moving `main` branch.
Current `main` may contain follow-up work under `CHANGELOG.md` `Unreleased`,
so it should be described as an unreleased development snapshot until tagged.

Before promoting a release, record the target commit, exact tag,
`node scripts/validate-all.mjs`, `git diff --check`, Bash hook syntax checks,
Codex runtime smoke, distribution risk scan, and skipped checks with the
[release evidence template](../../../docs/templates/evidence/release.md).
If Windows local validation reports skipped checks because Bash is not
available, describe that exactly and rely on CI/Linux evidence for the Bash
checks.

## Quick Start

### Prerequisites

- Claude Code plugin marketplace access with third-party marketplace support.
- Regular `nova-plugin` commands require only the installed plugin.
- Codex loop commands require a locally callable Codex CLI and Bash for the skill scripts.
- Repository maintenance and local validation require Node.js 22+.

### Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add lliangcol/llm-plugins-fusion@v4.0.0
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
/nova-plugin:explore analyze the current project structure and main risks
```

If you are not sure which command should start:

```bash
/nova-plugin:route This task touches docs, versioning, and install validation; recommend the next nova workflow step
```

Private consumer projects should maintain their own project-local profile before running the workflow. The public contract is in the [assistant adoption guide](../../../docs/guides/assistants/README.md).

### Default Workflow

```text
/nova-plugin:explore -> /nova-plugin:produce-plan -> /nova-plugin:review -> /nova-plugin:implement-plan -> /nova-plugin:finalize-work
```

| Current goal | Default command | Notes |
| --- | --- | --- |
| Understand the problem without solutions | `/nova-plugin:explore` | Gather facts, uncertainties, and risk signals only. |
| Produce a reviewable plan | `/nova-plugin:produce-plan` | Write a formal plan for review and implementation. |
| Review plans, code, or risk | `/nova-plugin:review` | Defaults to standard depth; use `LEVEL=lite|strict` to adjust. |
| Implement an approved plan | `/nova-plugin:implement-plan` | Requires a clear plan and `PLAN_APPROVED=true`. |
| Summarize delivery and follow-ups | `/nova-plugin:finalize-work` | Freeze state and write delivery notes without expanding scope. |

Minimal copyable examples:

| Command | Example |
| --- | --- |
| `/nova-plugin:explore` | `/nova-plugin:explore summarize facts, uncertainties, and risks for this requirement; no solutions` |
| `/nova-plugin:produce-plan` | `/nova-plugin:produce-plan PLAN_OUTPUT_PATH=docs/plans/example.md PLAN_INTENT="write a reviewable plan for the confirmed requirement"` |
| `/nova-plugin:review` | `/nova-plugin:review LEVEL=standard review this plan or diff and return severity-ranked findings` |
| `/nova-plugin:implement-plan` | `/nova-plugin:implement-plan PLAN_INPUT_PATH=docs/plans/example.md PLAN_APPROVED=true` |
| `/nova-plugin:finalize-work` | `/nova-plugin:finalize-work summarize completed changes, validation, limitations, and follow-ups` |

## Command Map

New users and consumer profiles should default to the five main entries: `/nova-plugin:explore`, `/nova-plugin:produce-plan`, `/nova-plugin:review`, `/nova-plugin:implement-plan`, and `/nova-plugin:finalize-work`. Use read-only `/nova-plugin:route` first when the right entry point is unclear. Other commands remain available as advanced or compatibility entries without behavior changes.

| Stage | Goal | Main entry | Advanced / compatibility entries |
| --- | --- | --- | --- |
| Explore | Choose an entry point, understand the problem, gather facts, expose uncertainty | `/nova-plugin:route`, `/nova-plugin:explore` | `/nova-plugin:senior-explore`, `/nova-plugin:explore-lite`, `/nova-plugin:explore-review` |
| Plan | Produce an implementation plan or design document | `/nova-plugin:produce-plan` | `/nova-plugin:plan-lite`, `/nova-plugin:plan-review`, `/nova-plugin:backend-plan` |
| Review | Review code, plans, or branch risk | `/nova-plugin:review` | `/nova-plugin:review-lite`, `/nova-plugin:review-only`, `/nova-plugin:review-strict`, `/nova-plugin:codex-review-only`, `/nova-plugin:codex-verify-only` |
| Implement | Execute an approved plan | `/nova-plugin:implement-plan` | `/nova-plugin:implement-standard`, `/nova-plugin:implement-lite`, `/nova-plugin:codex-review-fix` |
| Finalize | Summarize delivery, risks, verification, and follow-ups | `/nova-plugin:finalize-work` | `/nova-plugin:finalize-lite` |

Common path:

```text
/nova-plugin:explore -> /nova-plugin:produce-plan -> /nova-plugin:review -> /nova-plugin:implement-plan -> /nova-plugin:finalize-work
```

Codex loop path:

```text
/nova-plugin:codex-review-only -> fix -> /nova-plugin:codex-verify-only
```

Or use the semi-automated loop:

```text
/nova-plugin:codex-review-fix
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
| Memory | `CLAUDE.md`, `AGENTS.md`, `docs/templates/consumer-profiles/` | Claude guidance source, non-Claude agent adapter, consumer profile boundaries, public/private information separation |
| Skills | `nova-plugin/skills/`, `nova-plugin/commands/` | Six canonical behavior skills, generated command wrappers, variant presets, safety boundaries, and output contracts |
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
|   |-- skills/                       # 6 canonical nova-* skills + _shared policies
|   |-- agents/                       # 6 core active agents
|   |-- packs/                        # 8 capability pack docs
|   |-- docs/                         # user docs, command docs, and current architecture notes
|   `-- hooks/                        # Claude Code hook config and scripts
|-- docs/
|   |-- README.md                     # repository-level documentation index
|   |-- assets/                       # media referenced by maintained public docs
|   |-- generated/                    # generated inventories, matrices, and reports
|   |-- getting-started/              # first-run and installation paths
|   |-- guides/                       # task-oriented assistant, framework, and workflow guides
|   |-- marketplace/                  # generated marketplace catalog
|   |-- operations/                   # community, maintainer, marketplace, and release operations
|   |-- project/                      # decisions, migrations, plans, and release notes
|   |-- reference/                    # architecture, compatibility, evaluation, security, and workflow contracts
|   |-- templates/                    # consumer profiles, evidence records, and prompts
|   `-- tutorials/                    # public-safe examples and walkthroughs
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
| [CLAUDE.md](../../../CLAUDE.md) | Canonical repository guidance for Claude Code and shared project facts | Claude Code work in this repository |
| [AGENTS.md](../../../AGENTS.md) | Lightweight Codex and generic AI-agent adapter | Non-Claude agent work in this repository |
| [CONTRIBUTING.md](../../../CONTRIBUTING.md) | PR, marketplace entry, and command/skill maintenance rules | Contributing or changing structure |
| [CHANGELOG.md](../../../CHANGELOG.md) | Version history and unreleased changes | Understanding version impact |
| [ROADMAP.md](../../../ROADMAP.md) | Roadmap, non-goals, and maintenance rules | Planning follow-up work |
| [SECURITY.md](../../../SECURITY.md) | Support range, vulnerability reporting, and disclosure policy | Security issue handling |
| [CODE_OF_CONDUCT.md](../../../CODE_OF_CONDUCT.md) | Contributor code of conduct | Community collaboration |
| [Consumer profile templates](../../../docs/guides/assistants/README.md) | Multi-project consumer profile contract and redacted Java backend / frontend templates | Private project adoption |
| [Cursor setup](../../../docs/guides/assistants/cursor.md) | Consuming `nova-route` and core nova skills from Cursor rules | Non-Claude Code adoption |
| [Gemini CLI setup](../../../docs/guides/assistants/gemini-cli.md) | Consuming nova workflows from Gemini CLI context or skills | Non-Claude Code adoption |
| [OpenCode setup](../../../docs/guides/assistants/opencode.md) | OpenCode intent-to-skill routing and fallback notes | Non-Claude Code adoption |
| [Copilot setup](../../../docs/guides/assistants/copilot.md) | GitHub Copilot instructions and core-agent mapping | Non-Claude Code adoption |
| [Codex setup](../../../docs/guides/assistants/codex.md) | Codex Markdown skill consumption and Codex loop prerequisites | Codex / other agent adoption |
| [Workbench consumer template](../../../docs/templates/consumer-profiles/workbench.md) | Private workspace structure, naming, checkpoint, and handoff rules | Long-running process assets |
| [Redacted examples](../../../docs/tutorials/README.md) | Redacted Java backend and frontend workflow examples | Writing private profiles or handoff templates |
| [Workflow evaluation examples](../../../docs/tutorials/workflow-evaluation.md) | Public-safe five-stage workflow examples, rubrics, and failure signals | Evaluating command output quality |
| [Context-safe workflows](../../../docs/guides/workflows/context-safe.md) | Review, fix, documentation, and handoff loops that avoid context blow-up | Large-task decomposition and resumability |
| [Prompt template library](../../../docs/templates/prompts/README.md) | Codex, Claude Code, and delivery documentation prompt templates | Copying into private consumer projects |
| [Command Reference Guide](../guides/commands-reference-guide.en.md) | Parameters, examples, workflow templates | Daily command lookup |
| [Command Handbook](../guides/claude-code-commands-handbook.en.md) | Command selection and copy-ready usage | Quick start |
| [Codex Loop Guide](../commands/codex/codex-review-fix.README.en.md) | review / fix / verify collaboration | Claude Code + Codex |
| [Skill-first design](../architecture/dual-track-design.md) | Command and skill responsibilities | Changing commands or skills |
| [Hooks design](../architecture/hooks-design.md) | Pre-write checks and audit hooks | Maintaining safety boundaries |
| [Agent Development Stack](../architecture/agent-development-stack.md) | Five-layer architecture, source files, and validation gates | Understanding or maintaining the plugin stack |
| [Core agent routing](../../../docs/reference/architecture/agent-routing.md) | Routing rules for 6 core agents and capability packs | Choosing or maintaining agents |
| [Plugin-aware routing](../../../docs/reference/architecture/agent-routing.md) | Enhanced / fallback mode and pack activation rules | Maintaining pack routing |
| [Marketplace catalog](../../../docs/marketplace/catalog.md) | Generated plugin catalog and compatibility evidence | Browsing marketplace entries |
| [Marketplace portal IA](../../../docs/project/plans/portal-information-architecture.md) | Marketplace portal information architecture, data sources, current `v4.0.0` single-plugin boundary, and deferred multi-plugin boundary | Evaluating the deferred portal boundary |
| [multi-plugin readiness evidence](../../../docs/project/plans/multi-plugin-readiness.md) | Version-independent evidence ledger for production multi-plugin activation | Evaluating demonstrated ownership and release pressure |
| [Registry author workflow](../../../docs/operations/marketplace/registry-authoring.md) | Plugin entry updates, scaffold dry-run, profiles, and validation flow | Plugin authors and maintainers |
| [Compatibility matrix](../../../docs/reference/compatibility/marketplace.md) | Claude Code, Codex CLI, Bash, Node.js, and optional enhanced tools | Reviewing compatibility |
| [Trust policy](../../../docs/reference/security/marketplace-trust.md) | Trust/risk/deprecation/last-updated/maintainer semantics and review requirements | Reviewing marketplace metadata |
| [Security review route](../../../docs/reference/security/security-review.md) | Security-sensitive plugin change route and minimum checks | Security review |
| [Release hygiene](../../../docs/operations/releases/hygiene.md) | Tag/version sync, generated drift, changelog, and pre-release review | Release preparation |
| [Release evidence template](../../../docs/templates/evidence/release.md) | Environment, tag, validation, and skipped-check evidence before release or promotion | Release evidence capture |
| [Capability packs](../../packs/README.md) | Index for 8 domain capability packs | Maintaining packs |

## Maintenance

Version and registry sources:

- `nova-plugin/.claude-plugin/plugin.json`: development/candidate plugin metadata and base-version source
- `package.json`: repository-tooling version; it must match the plugin manifest
- `governance/release-channels.json`: stable version, exact tag, and commit source
- `.claude-plugin/registry.source.json`: stable distribution source plus registry, marketplace display, and trust/risk/maintainer/evidence metadata
- `.claude-plugin/marketplace.json`: generated Claude marketplace manifest
- `.claude-plugin/marketplace.metadata.json`: generated repository-local metadata
- `docs/marketplace/catalog.md`: generated Markdown catalog
- `CHANGELOG.md`

Skills own runtime behavior. Commands are generated compatibility and
discoverability wrappers; they must not duplicate behavior:

```text
workflow-specs/workflows.json
  -> nova-plugin/skills/nova-<canonical-surface>/SKILL.md
  -> nova-plugin/commands/<id>.md
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
node scripts/validate-plugin-install.mjs --dry-run
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
bash -n nova-plugin/hooks/scripts/pre-bash-check.sh
bash -n nova-plugin/hooks/scripts/trusted-node-hook.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

Claude plugin install dry run does not call Claude CLI and does not mutate
user-scope plugin state. Real install smoke requires Claude CLI and must run
only in CI or an isolated test-user environment:

```bash
node scripts/validate-plugin-install.mjs --dry-run
node scripts/validate-plugin-install.mjs --accept-user-scope-mutation
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

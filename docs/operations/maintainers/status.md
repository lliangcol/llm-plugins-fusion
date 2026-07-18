<!-- migrated-from: docs/llm-plugins-fusion-maintenance-status.md -->
# LLM Plugins Fusion Maintenance Status

<!-- generated:project-state:start -->
## Current Machine-Derived Project Facts

Do not edit this block by hand. It is synchronized by
`node scripts/generate-project-state.mjs --write` from repository domain
sources and `governance/product-lanes.json`.

- Plugin: `nova-plugin@4.1.0`; production plugins: 1; public path: `nova-plugin/`
- Runtime: Node.js `>=22`; distributed Bash helpers: `3.2+`
- Inventory: 21 commands, 6 skills, 6 active agents, 8 capability packs
- Workflow contract: schema v5, namespace `nova-plugin`, 21 workflows
- Evaluation datasets: `live-paired` has 168 cases and 2016 planned paired invocations; `real-task-benchmark` has 24 tasks and 432 planned invocations
- Package scripts: `check` is present; `build` is absent
- Active product lanes: `workflow-framework`, `single-plugin-delivery`, `release-candidate-promotion`, `live-assistant-evaluation`, `generic-framework-kernel`
- Planned product lanes: None
- Deferred product lanes: `production-multi-plugin-layout`, `public-portal`, `runtime-dynamic-loading`, `broad-domain-command-expansion`
- Release model: `candidate-and-promotion`
- Active PreToolUse launcher: `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh`, `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-bash-check.sh`
- Active PostToolUse launcher: `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/trusted-node-hook.sh post-write-verify`, `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/trusted-node-hook.sh post-audit-log`
<!-- generated:project-state:end -->

Status: active
Date: 2026-07-18
Scope: current source organization, maintenance boundaries, and executable gates

## Project Positioning

`llm-plugins-fusion` is a public AI engineering workflow framework centered on
`nova-plugin`. The production workflow is:

```text
Explore -> Plan -> Review -> Implement -> Finalize
```

`nova-plugin` is the only production plugin. Marketplace metadata remains the
installation and distribution mechanism. The repository must not be
described as a mature multi-plugin ecosystem, public portal, paid marketplace,
runtime dynamic plugin platform, or enterprise private knowledge base unless
future implementation and roadmap evidence establish those products.

## Sources Of Truth

| Area | Source |
| --- | --- |
| Repository guidance and architecture | `CLAUDE.md` |
| Codex and generic-agent behavior | `AGENTS.md` |
| Workflow authoring | `workflow-specs/workflows.json`, `workflow-specs/behaviors.json` |
| Product and adapter metadata | `workflow-specs/framework.json`, `workflow-specs/nova.product.json`, `workflow-specs/adapters/` |
| Plugin development version | `nova-plugin/.claude-plugin/plugin.json` |
| Stable release identity | `governance/release-channels.json` |
| Registry authoring | `.claude-plugin/registry.source.json` |
| Current remediation and residual gates | `docs/project/plans/current-remediation.md` |
| Repository and plugin navigation | `docs/README.md`, `nova-plugin/docs/README.md` |

Generated projections are evidence, not authoring sources. When a generated
file drifts, correct its listed source and rerun the owning generator.

## Current Inventory

- Commands: 21 files under `nova-plugin/commands/*.md`.
- Skills: 6 files under `nova-plugin/skills/nova-*/SKILL.md`.
- Active agents: 6 core files under `nova-plugin/agents/*.md`.
- Capability packs: 8 documentation packs under `nova-plugin/packs/*/README.md`.
- Current stable plugin version: `4.0.0` from exact tag `v4.0.0`.
- Development metadata is `4.1.0`; moving `main` is not stable release evidence.

## Directory Responsibilities

| Path | Responsibility |
| --- | --- |
| `.claude-plugin/` | Registry source and generated marketplace projections. |
| `.github/` | CI, governance, release, security, and issue-intake orchestration. |
| `adapters/` | Assistant adapter contracts and compatibility guidance. |
| `docs/` | Public repository guidance grouped by getting-started, guides, reference, operations, project, templates, tutorials, and generated evidence. |
| `evals/` | Governed evaluation datasets, baselines, profiles, and evidence inputs. |
| `fixtures/` | Public-safe product, consumer, workflow, registry, and validation fixtures. |
| `framework/` | Generic framework kernel and safe shared I/O. |
| `governance/` | Machine-readable policy, release identity, evidence registries, and documentation ownership. |
| `nova-plugin/` | The single production plugin: commands, canonical skills, agents, packs, hooks, runtime contracts, and plugin docs. |
| `packages/` | Private spec, compiler, conformance, and CLI workspaces. |
| `schemas/` | JSON Schemas for governed inputs and evidence. |
| `scripts/` | Generators, validators, release tooling, and hardened shared libraries. |
| `tests/` | Unit, integration, and end-to-end regression suites. |
| `workflow-specs/` | Canonical workflow and behavior authoring plus generated typed projections. |

Pre-v5 documentation paths listed in `governance/docs-migrations.json` are
governed compatibility stubs, not duplicate active documentation. Do not remove
them before their declared retirement version.

## Maintenance Boundary

- Keep public content free of private consumer identifiers, paths, endpoints,
  credentials, repositories, configuration values, and business rules.
- Do not commit `.codex/`, `.metrics/`, dependency trees, coverage output, or
  other runtime artifacts.
- Do not hand-edit marketplace outputs, typed workflow projections, generated
  command wrappers, generated Skill blocks, or generated documentation.
- Preserve the six-Skill/21-command projection and the exact active agent and
  capability-pack inventories.
- Treat release, hook, source-snapshot, artifact-output, and GitHub workflow
  changes as high-risk review units with focused fault or mutation evidence.
- Record Bash-dependent checks as passed only when Bash actually executes.

## Executable Gates

For a broad change, regenerate canonical projections before validation:

```bash
npm run llmf -- generate all --write
node scripts/validate-all.mjs
npm run test:coverage:check
git diff --check
```

Useful focused gates include:

```bash
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:mutation:critical
npm run test:fault-injection
npm run validate:docs
npm run validate:github-workflows
npm run validate:runtime
npm run scan:distribution
```

The safe plugin-install preview is
`node scripts/validate-plugin-install.mjs --dry-run`. The
`--accept-user-scope-mutation` path may change a user's Claude Code state and
belongs only in CI or an isolated test-user environment.

## Current Boundary

The 2026-07-18 `main` baseline is source-complete for the implemented 4.1.0
development surface. Candidate performance, authenticated assistant runs,
independent approval, protected publication, observation time, install proof,
and external adoption remain evidence gates rather than local implementation
claims. See `docs/project/plans/current-remediation.md` for the concise ledger.

Historical maintenance rounds, exact test totals, and superseded improvement
candidates belong in Git history and the changelog, not in this current-status
page.

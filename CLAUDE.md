# CLAUDE.md

<!-- generated:project-state:start -->
## Current Machine-Derived Project Facts

Do not edit this block by hand. It is synchronized by
`node scripts/sync-doc-facts.mjs --write` from repository domain sources and
`governance/product-lanes.json`.

- Plugin: `nova-plugin@4.0.0`; production plugins: 1; public path: `nova-plugin/`
- Runtime: Node.js `>=22`; distributed Bash helpers: `3.2+`
- Inventory: 21 commands, 6 skills, 6 active agents, 8 capability packs
- Workflow contract: schema v5, namespace `nova-plugin`, 21 workflows
- Evaluation datasets: `live-paired` has 168 cases and 1008 planned paired invocations; `real-task-benchmark` has 24 tasks and 432 planned invocations
- Package scripts: `check` is present; `build` is absent
- Active product lanes: `workflow-framework`, `single-plugin-delivery`, `release-candidate-promotion`, `live-assistant-evaluation`, `generic-framework-kernel`
- Planned product lanes: None
- Deferred product lanes: `production-multi-plugin-layout`, `public-portal`, `runtime-dynamic-loading`, `broad-domain-command-expansion`
- Release model: `candidate-and-promotion`
- Active PreToolUse launcher: `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh`, `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-bash-check.sh`
- Active PostToolUse launcher: `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-write-verify.mjs`, `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-audit-log.mjs`
<!-- generated:project-state:end -->

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
Do not describe this repository as a mature multi-plugin ecosystem or a public
portal unless future evidence and roadmap updates say so. Public docs may
include generic workflow guidance, consumer profile contracts, redacted
examples, prompt templates, and capability pack guidance. Real consumer
profiles belong in the consumer project's own `AGENTS.md`, `CLAUDE.md`,
`.claude/`, or private docs.

## Quick Facts

- Marketplace entry: `.claude-plugin/marketplace.json`
- Marketplace custom metadata: `.claude-plugin/marketplace.metadata.json`
- Registry generation source: `.claude-plugin/registry.source.json`
- Registry multi-entry fixture: `fixtures/registry/multi-plugin/`
- Generated marketplace catalog: `docs/marketplace/catalog.md`
- Main plugin metadata and version source: `nova-plugin/.claude-plugin/plugin.json`
- Current command snapshot: 21 files under `nova-plugin/commands/*.md`; validate frontmatter with `node scripts/lint-frontmatter.mjs`.
- Current skill snapshot: 6 files under `nova-plugin/skills/nova-*/SKILL.md`; validate frontmatter with `node scripts/lint-frontmatter.mjs`.
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
- Product-lane decisions: `governance/product-lanes.json`
- Generated project-state aggregate: `governance/project-state.generated.json`
- Maintainer npm shortcuts: `package.json` (`llmf`, `doctor`, `validate:bootstrap`, `demo:all`, `demo:route`,
  `demo:review`, `validate`,
  `test`, `test:coverage`, `test:coverage:check`, `test:unit`,
  `test:integration`, `test:e2e`, `lint`,
  `ci:quick`, `ci:full`, `validate:maintainer`,
  `validate:drift`, `validate:docs`, `validate:schemas`,
  `validate:github-workflows`, `validate:runtime`, `validate:regression`,
  `validate:surface`, `validate:workflow`, `validate:project-state`,
  `scan:secrets`, `scan:distribution`, `scaffold:consumer`, and `check`;
  `build` is intentionally absent because the distributable plugin is assembled
  by `release:artifacts`)
- Repository validation scripts require Node.js 22+. Distributed shell helpers
  support Bash 3.2+. Hook shell syntax and runtime smoke checks require Bash;
  Windows without Bash may warning-skip
  local Bash-dependent checks, while CI/Linux and CI/Windows Bash smoke must
  run them.
- `.node-version` records the intended local Node major for maintainers;
  `package.json` `engines.node` remains the canonical support contract.

## Sources of Truth

| Area | Source |
| --- | --- |
| Plugin metadata and version | `nova-plugin/.claude-plugin/plugin.json` |
| Registry-owned marketplace fields | `.claude-plugin/registry.source.json` |
| Generated marketplace outputs | `.claude-plugin/marketplace.json`, `.claude-plugin/marketplace.metadata.json`, `docs/marketplace/catalog.md` |
| Marketplace and plugin schemas | `schemas/registry-source.schema.json`, `schemas/marketplace.schema.json`, `schemas/marketplace-metadata.schema.json`, `schemas/plugin.schema.json` |
| Canonical workflow, capability, ownership, input, and output contracts | `workflow-specs/workflows.json` |
| Generated runtime permissions and workflow catalogs | `nova-plugin/runtime/workflow-permissions.json`, `nova-plugin/runtime/route-output-contract.json`, `docs/generated/workflow-catalog.*` |
| Assistant adapters and evaluation datasets | `adapters/`, `evals/` |
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
| Product-lane decisions | `governance/product-lanes.json` |
| Dependency review policy | `governance/dependency-policy.json` |
| Generated project truth | `governance/project-state.generated.json` |

Generated marketplace files must be updated from their sources with:

```bash
node scripts/generate-registry.mjs --write
```

Workflow surfaces, runtime permissions, route ownership, catalogs, and adapters
must be regenerated from `workflow-specs/workflows.json` with:

```bash
node scripts/generate-workflow-permissions.mjs --write
node scripts/generate-adapters.mjs --write
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
|   |-- codeql.yml
|   |-- dependency-audit.yml
|   |-- dependency-review.yml
|   |-- label-sync.yml
|   |-- plugin-install-smoke.yml
|   |-- pr-governance.yml
|   |-- nightly.yml
|   |-- promote-release.yml
|   |-- release-candidate.yml
|   |-- release-recovery-drill.yml
|   `-- release.yml
|-- docs/
|   |-- README.md
|   |-- agents/
|   |-- consumers/
|   |-- examples/
|   |-- generated/
|   |-- marketplace/
|   |-- prompts/
|   |-- releases/
|   |-- workflows/
|   `-- project-optimization-plan.md
|-- fixtures/registry/multi-plugin/
|-- nova-plugin/
|   |-- .claude-plugin/plugin.json
|   |-- commands/                     # 21 Claude Code command definitions
|   |-- skills/                       # 6 canonical Agent Skills plus shared policies
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
node scripts/validate-github-workflows.mjs
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/pre-bash-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
node scripts/validate-runtime-smoke.mjs
node scripts/validate-surface-budget.mjs
node scripts/generate-surface-inventory.mjs
node scripts/scan-distribution-risk.mjs
node scripts/generate-release-checksums.mjs
node scripts/validate-regression.mjs
node scripts/validate-workflow-fixtures.mjs
node scripts/validate-docs.mjs
```

Maintainer validation uses development-only Ajv dependencies. Install the
locked toolchain first; the distributed `nova-plugin` archive itself remains
free of Node package runtime dependencies:

```bash
npm ci --ignore-scripts
```

Maintainer npm shortcuts:

```bash
npm run doctor
npm run validate:bootstrap
npm run demo:all
npm run demo:route
npm run demo:review
npm run test
npm run test:coverage
npm run test:coverage:check
npm run test:unit
npm run test:integration
npm run test:e2e
npm run lint
npm run ci:quick
npm run ci:full
npm run llmf -- check quick
npm run llmf -- check full
npm run llmf -- check security
npm run llmf -- check release
npm run llmf -- generate all
npm run validate:drift
npm run validate
npm run validate:maintainer
npm run validate:docs
npm run validate:schemas
npm run validate:github-workflows
npm run validate:runtime
npm run validate:regression
npm run validate:surface
npm run validate:workflow
npm run scan:secrets
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

Claude CLI install smoke is intentionally separate. The dry run is the safe
preview path; the mutation path may install or update a user-scope plugin and
should run only in CI or an isolated test-user environment:

```bash
node scripts/validate-plugin-install.mjs --dry-run
node scripts/validate-plugin-install.mjs --accept-user-scope-mutation --isolated-home
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

Skills are the canonical runtime behavior surface. All commands are generated
compatibility or discoverability wrappers and must not duplicate behavior:

```text
workflow-specs/workflows.json
  -> nova-plugin/skills/nova-<canonical-surface>/SKILL.md
  -> nova-plugin/commands/<id>.md
```

Command frontmatter must include:

```yaml
id: <id>
stage: explore|plan|implement|review|finalize
title: /<id>
description: "When to use this command..."
destructive-actions: none|low|medium|high
allowed-tools: <space-separated tool list>
disallowed-tools: <space-separated tool list>
user-invocable: true
disable-model-invocation: true|false
```

Skill frontmatter must include:

```yaml
name: nova-<id>
description: "..."
license: MIT
allowed-tools: <space-separated tool list>
metadata:
  nova-user-invocable: "true"
  nova-model-invocable: "true|false"
  nova-subagent-safe: "true|false"
  nova-destructive-actions: "none|low|medium|high"
```

Read-only commands normally pre-approve `Read Glob Grep`. Write-capable
commands may also pre-approve `Write Edit`; Bash follows the normal permission
flow unless it is explicitly disallowed.

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

- `/nova-plugin:route` is read-only and recommends the next command, skill, core agent,
  capability packs, required inputs, validation expectations, and fallback path.
- `/nova-plugin:explore` routes by `PERSPECTIVE=observer|reviewer`.
- `/nova-plugin:review` adjusts depth by `LEVEL=lite|standard|strict`.
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
`node scripts/validate-packs.mjs` also guards the documentation-only pack
boundary: packs are routing and validation guidance, optional enhanced tools
are not hard dependencies, fallback mode remains required, and runtime dynamic
loading is not current behavior.

If the active agent or pack set changes, update the files, verification scripts,
routing docs, migration notes when relevant, `CLAUDE.md`, and `AGENTS.md`.

### Hooks

`nova-plugin/hooks/hooks.json` enables:

- `PreToolUse`: matches `Write|Edit|NotebookEdit` and runs the thin
  fail-closed Bash launcher. Node.js 22+ performs the
  fail-closed payload, workspace-containment, path-component, target-type,
  secret, proposed Edit, and protected `hooks.json` validation. NotebookEdit
  fails closed because complete proposed notebook content cannot be
  reconstructed reliably.
- A second `PreToolUse` entry matches `Bash` and blocks common write-bypass
  forms such as redirection, compound shell programs, direct filesystem
  mutators, inline interpreters, and mutating Git/package subcommands before
  the normal Bash permission prompt. This narrows risk but is not a sandbox;
  an allowed validation script can still have its own side effects.
- `PostToolUse` synchronously rechecks actual `Write|Edit` targets after the
  runtime operation. A containment, target-type, hard-link, or protected
  `hooks.json` violation emits a high-severity failure and stops the subsequent
  workflow, but cannot roll back the completed write.
- `PostToolUse`, `PostToolUseFailure`, and `PermissionDenied` also match
  `Write|Edit|NotebookEdit|Bash` and asynchronously invoke
  `hooks/scripts/post-audit-log.mjs` through exec-form Node.

Post-use audit hooks use exec-form Node.js 22+ with `CLAUDE_PLUGIN_ROOT`.
PreToolUse retains a Bash 3.2+ launcher because a missing exec-form Node command
is non-blocking in the supported Claude runtime; Codex helpers also use Bash. Exit 0
means that the hook made no blocking decision; it is not a permission grant.
`NOVA_WRITE_GUARD_DISABLED=1` is an explicit bypass and is not valid release
evidence.

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
| Guardrails | `.github/workflows/**`, `nova-plugin/hooks/**`, `scripts/validate-*.mjs`, distributed Bash scripts | `node scripts/validate-github-workflows.mjs`, `node scripts/validate-hooks.mjs`, hook `bash -n`, changed script validation, `node scripts/validate-surface-budget.mjs` when prompt surfaces change, `node scripts/generate-surface-inventory.mjs` when public surfaces change, `node scripts/validate-regression.mjs` when validator behavior changes |
| Delegation | `nova-plugin/agents/**`, `nova-plugin/packs/**`, `docs/agents/**` | `bash scripts/verify-agents.sh` or `.\scripts\verify-agents.ps1`, plus `node scripts/validate-packs.mjs` |
| Distribution | `.claude-plugin/registry.source.json`, `nova-plugin/.claude-plugin/plugin.json`, generated marketplace outputs | `node scripts/generate-registry.mjs --write`, `node scripts/validate-schemas.mjs`, `node scripts/validate-registry-fixtures.mjs`, `node scripts/validate-claude-compat.mjs`; `node scripts/validate-plugin-install.mjs` when install smoke is required |

`node scripts/validate-docs.mjs` validates Markdown links and anchors, command
doc coverage and stage placement, version/date sync, inventory counts, current
project positioning contracts, exact-tag release promotion boundaries,
maintainer diagnostic and security setting semantics, public API compatibility
contracts, marketplace trust, author workflow, compatibility, and security
review contracts, contribution and issue intake contracts, docs index
navigation contracts, consumer profile privacy contracts, prompt template
privacy contracts, local data handling privacy contracts, workflow evidence contracts, showcase public-safety
contracts, growth metrics privacy contracts, assets capture privacy contracts,
deferred portal IA contracts, multi-plugin readiness evidence contracts, security support
range, stale active planning labels, and
non-archived report status.

Prompt-surface budget checks are a bloat guard, not a quality metric. Run
`node scripts/validate-surface-budget.mjs` when command, skill, agent, or pack
surfaces change.

Current CI includes verify-agents, validate-packs, validate-schemas,
validate-registry-fixtures, Claude Manifest Static, Validate Workflow Permissions,
NPM Test, Test Coverage,
plugin install dry run, lint-frontmatter, validate-hooks, ShellCheck, GitHub workflow permission, inventory, and required-check validation, including action SHA
pinning and the NPM Test gate, hook `bash -n`, runtime smoke, surface budget,
surface inventory,
distribution risk scan, validation regression checks, workflow fixture
validation, validate-docs, CodeQL, a Windows Node/PowerShell smoke job for
schemas, docs, frontmatter, and `scripts/verify-agents.ps1`, PSScriptAnalyzer,
a Windows Bash smoke job for hook syntax and Codex runtime smoke, and a macOS
smoke job for schemas, frontmatter, docs, agent verification, and runtime
smoke. Workflow YAML is limited to orchestration and fixed argv; release
identity and transition semantics live in the Node release state machine.
PR governance is exposed as a separate lightweight required check that validates
non-placeholder PR evidence, large-change exceptions, and current-head independent
approval for sensitive paths. The tracked validator owns behavior and explicit
`.github/CODEOWNERS` entries own the sensitive-path set; GitHub code-owner
review and stale-approval settings remain required owner-side controls. Real
user-scope plugin install smoke is isolated in
`.github/workflows/plugin-install-smoke.yml` for manual or
scheduled evidence and in `.github/workflows/release-candidate.yml` as an
exact-RC-tag blocker. Stable `.github/workflows/release.yml` only delegates
promotion of the already verified candidate; install smoke is not a default
merge blocker.

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
- Broad or multi-step work should leave review-unit or acceptance-unit
  checkpoints with evidence, verified behavior or facts, skipped checks, and
  residual risk.
- Validation claims require observed command output or artifact evidence; when
  claiming behavior or facts are verified, also state the supporting evidence.
  Skipped or unavailable checks need an explicit reason.
- When repository instructions conflict, surface the conflict and follow the
  source-of-truth table instead of blending incompatible rules.
- The six canonical `skills/nova-*/SKILL.md` files own behavior; all 21
  `commands/*.md` files are generated thin wrappers, including 15 deprecated aliases.
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

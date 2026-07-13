# Repository Documentation Index

Status: active
Date: 2026-06-02

This is the repository-level map for public documentation under `docs/`.
Use [nova-plugin/docs/README.md](../nova-plugin/docs/README.md) for
plugin-specific user docs, command docs, and current architecture notes.

Detailed local indexes remain in subdirectories that need them, such as
`docs/consumers/`, `docs/examples/`, and `docs/prompts/`. This page owns the
directory-level navigation for `docs/` so the root README does not need to
duplicate every document.

## Public Navigation Boundary

`docs/showcase/` and `docs/examples/` are public-safe navigation aids, not a
public portal or real consumer case-study library. Showcase pages explain
reusable scenario workflows; examples provide redacted fixtures, rubrics, and
templates. Keep consumer-specific profiles, endpoints, credentials, local
paths, runtime flags, business rules, private repository addresses, and private
knowledge-base content in the consumer-owned workspace.

## Start Here

| Need | Entry |
| --- | --- |
| Choose the shortest path by persona or task | [start-here.md](start-here.md) |
| Get started quickly with `nova-plugin` | [getting-started.md](getting-started.md) |
| See scenario-based workflow examples | [showcase/README.md](showcase/README.md) |
| Prepare social preview and demo capture assets | [assets/README.md](assets/README.md) |
| Track growth metrics and manual promotion channels | [growth/README.md](growth/README.md) |
| Understand local audit logs and data handling | [privacy/data-handling.md](privacy/data-handling.md) |
| Inspect generated public surface inventory | [generated/surface-inventory.md](generated/surface-inventory.md) |
| Adopt `nova-plugin` in a private project | [consumers/README.md](consumers/README.md) |
| Maintain repository checks and release gates | [maintainers/quickstart.md](maintainers/quickstart.md) |
| Find the script, npm shortcut, or CI job for a maintenance task | [maintainers/task-catalog.md](maintainers/task-catalog.md) |
| Understand current compatibility evidence and boundaries | [compatibility/README.md](compatibility/README.md) |
| Use the framework/compiler and llmf preview | [framework/README.md](framework/README.md) |
| Understand assistant L1-L4 evidence claims | [compatibility/assistant-levels.md](compatibility/assistant-levels.md) |
| Inspect reproducible workflow quality evidence | [quality/benchmark.md](quality/benchmark.md) |
| Choose a nova command or inspect plugin docs | [../nova-plugin/docs/README.md](../nova-plugin/docs/README.md) |
| Understand core agents and capability pack routing | [agents/ROUTING.md](agents/ROUTING.md) |
| Reuse public-safe workflow prompts | [prompts/README.md](prompts/README.md) |
| Split large agent work into resumable units | [workflows/context-safe-agent-workflows.md](workflows/context-safe-agent-workflows.md) |
| Review GSD-informed reliability hardening | [workflows/gsd-informed-hardening.md](workflows/gsd-informed-hardening.md) |
| Maintain routing and validation guardrails | [workflows/routing-validation-guardrails.md](workflows/routing-validation-guardrails.md) |
| Design source-controlled workflow checks | [workflows/source-controlled-checks.md](workflows/source-controlled-checks.md) |
| Understand verification evidence standards | [workflows/verification-evidence-contract.md](workflows/verification-evidence-contract.md) |
| Maintain marketplace registry metadata | [marketplace/registry-author-workflow.md](marketplace/registry-author-workflow.md) |
| Prepare release or promotion evidence | [releases/release-evidence-template.md](releases/release-evidence-template.md) |
| Run release validation manually | [releases/release-validation-runbook.md](releases/release-validation-runbook.md) |
| Operate candidate-to-stable promotion from one checklist | [maintainers/release-runbook.md](maintainers/release-runbook.md) |
| Review current project optimization work | [project-optimization-plan.md](project-optimization-plan.md) |
| Resume small-step maintenance rounds | [llm-plugins-fusion-maintenance-status.md](llm-plugins-fusion-maintenance-status.md) |

## Directory Map

```text
docs/
|-- README.md
|-- start-here.md                  # persona and task-oriented entry point
|-- getting-started.md              # shortest install and workflow entry
|-- assets/                       # social preview and demo capture guidance
|-- agents/                       # core agent routing and pack routing
|-- consumers/                    # public-safe consumer profile contracts and setup templates
|-- compatibility/                # public API and compatibility surface
|-- examples/                     # redacted workflow examples and evaluation templates
|-- generated/                    # generated public surface inventory
|-- growth/                       # growth metric definitions and collection cadence
|-- maintainers/                  # maintainer quickstart, troubleshooting, and GitHub settings
|-- marketplace/                  # generated catalog, registry workflow, trust, compatibility, and review docs
|-- privacy/                      # local audit log and public data handling boundaries
|-- prompts/                      # reusable public-safe prompt templates
|-- releases/                     # release evidence templates, runbooks, and hygiene docs
|-- showcase/                     # scenario-based public workflow examples
|-- workflows/                    # reusable agent workflow guidance
`-- project-optimization-plan.md  # active project optimization plan
```

## Directory Responsibilities

| Area | Owns |
| --- | --- |
| [agents/](agents/) | Core agent routing and plugin-aware routing. |
| [assets/](assets/) | Public-safe social preview and demo capture guidance. |
| [consumers/](consumers/) | Public-safe consumer profile contracts, redacted project templates, and cross-tool setup notes. |
| [compatibility/](compatibility/) | Public API and compatibility boundaries. |
| [quality/](quality/) | Generated static, simulation, mutation, and exact-version live benchmark evidence. |
| [examples/](examples/) | Redacted Java backend/frontend examples and workflow evaluation templates. |
| [generated/](generated/) | Generated public surface inventory for commands, skills, agents, packs, and marketplace outputs. |
| [growth/](growth/) | Growth metrics, traffic collection cadence, and manual channel record format. |
| [maintainers/](maintainers/) | Maintainer checks, troubleshooting, and GitHub security settings. |
| [marketplace/](marketplace/) | Marketplace catalog output, registry author workflow, compatibility, trust, security review, and multi-plugin readiness evidence. |
| [privacy/](privacy/) | Local audit log behavior, redaction boundary, and public data handling rules. |
| [prompts/](prompts/) | Copyable prompt templates for Codex, Claude Code, delivery docs, HTML artifacts, and workbench cleanup. |
| [releases/](releases/) | Release evidence templates, validation runbooks, and release hygiene rules. |
| [showcase/](showcase/) | Scenario-based public workflow examples for first-time visitors. |
| [workflows/](workflows/) | Context-safe agent workflows, routing/validation guardrails, and the thin-harness/fat-skills placement doctrine. |

## Current Documents

### Assets

| Document | Purpose |
| --- | --- |
| [assets/README.md](assets/README.md) | Social preview requirements, demo capture storyboard, and privacy boundary. |

### Agents

| Document | Purpose |
| --- | --- |
| [agents/ROUTING.md](agents/ROUTING.md) | Current 6-core-agent routing and capability pack hints. |
| [agents/PLUGIN_AWARE_ROUTING.md](agents/PLUGIN_AWARE_ROUTING.md) | Enhanced/fallback mode and pack activation rules. |

### Consumers

| Document | Purpose |
| --- | --- |
| [consumers/README.md](consumers/README.md) | Local index for consumer profile templates and public/private boundaries. |
| [consumers/profile-contract.md](consumers/profile-contract.md) | Required fields for public-safe consumer profiles. |
| [consumers/private-java-backend-template.md](consumers/private-java-backend-template.md) | Redacted Java/Spring backend profile template. |
| [consumers/frontend-project-template.md](consumers/frontend-project-template.md) | Redacted frontend project profile template. |
| [consumers/workbench-template.md](consumers/workbench-template.md) | Private workbench structure for requirements, plans, reviews, prompts, and handoffs. |
| [consumers/cursor-setup.md](consumers/cursor-setup.md) | Cursor setup for consuming nova skills. |
| [consumers/cline-setup.md](consumers/cline-setup.md) | Cline setup for consuming nova skills. |
| [consumers/aider-setup.md](consumers/aider-setup.md) | Aider setup for consuming nova skills. |
| [consumers/openhands-setup.md](consumers/openhands-setup.md) | OpenHands setup for consuming nova skills. |
| [consumers/gemini-cli-setup.md](consumers/gemini-cli-setup.md) | Gemini CLI setup for consuming nova workflows. |
| [consumers/opencode-setup.md](consumers/opencode-setup.md) | OpenCode intent-to-skill routing notes. |
| [consumers/copilot-setup.md](consumers/copilot-setup.md) | GitHub Copilot instruction mapping. |
| [consumers/codex-setup.md](consumers/codex-setup.md) | Codex setup and Codex loop prerequisites. |

### Examples

| Document | Purpose |
| --- | --- |
| [examples/README.md](examples/README.md) | Local index for public-safe examples. |
| [examples/workflow-evaluation.md](examples/workflow-evaluation.md) | Five-stage workflow evaluation examples, fixture validation command, and rubric. |
| [examples/workflow-evaluation-record-template.md](examples/workflow-evaluation-record-template.md) | Manual evidence record template for workflow-quality checks. |
| [examples/java-backend/redacted-feature.md](examples/java-backend/redacted-feature.md) | Generic Java/Spring workflow example. |
| [examples/frontend/basic-feature.md](examples/frontend/basic-feature.md) | Generic frontend workflow example. |

### Growth

| Document | Purpose |
| --- | --- |
| [growth/README.md](growth/README.md) | Stars, forks, issues, PRs, releases, traffic metrics, collection cadence, and manual channel record. |

### Generated

| Document | Purpose |
| --- | --- |
| [generated/surface-inventory.md](generated/surface-inventory.md) | Generated public surface inventory. |
| [generated/surface-inventory.json](generated/surface-inventory.json) | Machine-readable generated public surface inventory. |
| [generated/prompt-surface-report.md](generated/prompt-surface-report.md) | Aggregate workflow load graphs, duplication, and blocking prompt budgets. |
| [generated/real-task-benchmark.md](generated/real-task-benchmark.md) | Fixed benchmark plan, evidence boundary, metrics, intervals, and external gates. |

### Compatibility

| Document | Purpose |
| --- | --- |
| [compatibility/public-api.md](compatibility/public-api.md) | Stable commands, plugin identifiers, validation CLIs, generated file contracts, and breaking-change triggers. |
| [compatibility/assistant-levels.md](compatibility/assistant-levels.md) | Evidence definitions for parseable, invocable, enforced, and verified assistant adapters. |
| [compatibility/contract-semver.md](compatibility/contract-semver.md) | Independent Workflow IR, runtime contract, and adapter contract SemVer ranges and 4.x alias migration policy. |
| [framework/README.md](framework/README.md) | Framework/compiler evidence, protocol sources, and llmf preview contract. |
| [framework/second-product.md](framework/second-product.md) | Product-neutral specification, adapter, validation, build, and static eval guide. |
| [migrations/contract-v6.md](migrations/contract-v6.md) | Deterministic v5 to v6 migration and retained-alias decision. |

### Maintainers

| Document | Purpose |
| --- | --- |
| [maintainers/quickstart.md](maintainers/quickstart.md) | Maintainer change paths, default checks, timing evidence, and install smoke boundary. |
| [maintainers/validation-index.md](maintainers/validation-index.md) | Maintainer validation command, CI check, and change-routing inventory. |
| [maintainers/troubleshooting.md](maintainers/troubleshooting.md) | Common local validation, Bash, Claude CLI, hooks, audit log, and registry drift troubleshooting. |
| [maintainers/github-security-settings.md](maintainers/github-security-settings.md) | Branch protection, ruleset, CodeQL, secret scanning, Dependabot, and required-check guidance. |
| [maintainers/post-remediation-audit.md](maintainers/post-remediation-audit.md) | Current execution plan, post-remediation audit, evidence boundaries, residual risks, and phased ROI roadmap. |

### Marketplace

| Document | Purpose |
| --- | --- |
| [marketplace/catalog.md](marketplace/catalog.md) | Generated human-readable marketplace catalog. |
| [marketplace/registry-author-workflow.md](marketplace/registry-author-workflow.md) | Author workflow for registry and marketplace entry maintenance. |
| [marketplace/compatibility-matrix.md](marketplace/compatibility-matrix.md) | Compatibility matrix for Claude Code, Codex CLI, Bash, Node.js, and optional tools. |
| [migrations/2.4.1-command-namespace.md](migrations/2.4.1-command-namespace.md) | 2.4.1 namespaced invocation and 42-item dual-surface migration. |
| [migrations/3.0.0-adapters-and-direct-commands.md](migrations/3.0.0-adapters-and-direct-commands.md) | Node.js 22, direct command adapters, canonical workflow generation, and compatibility alias migration. |
| [marketplace/trust-policy.md](marketplace/trust-policy.md) | Trust, risk, deprecation, freshness, maintainer, and review metadata policy. |
| [marketplace/security-review-route.md](marketplace/security-review-route.md) | Security-sensitive marketplace change review route. |
| [marketplace/portal-information-architecture.md](marketplace/portal-information-architecture.md) | Deferred public portal information architecture. |
| [marketplace/multi-plugin-readiness.md](marketplace/multi-plugin-readiness.md) | Version-independent evidence ledger for production multi-plugin activation. |

### Privacy

| Document | Purpose |
| --- | --- |
| [privacy/data-handling.md](privacy/data-handling.md) | Local audit log behavior, best-effort redaction boundary, disable switch, and public data handling rules. |

### Prompts

| Document | Purpose |
| --- | --- |
| [prompts/README.md](prompts/README.md) | Local index and rules for public-safe prompt templates. |
| [prompts/codex/context-safe-review.md](prompts/codex/context-safe-review.md) | Codex review prompt for bounded branch or working-tree review. |
| [prompts/codex/final-verification.md](prompts/codex/final-verification.md) | Codex verification prompt after fixes exist. |
| [prompts/claude-code/fix-from-review.md](prompts/claude-code/fix-from-review.md) | Claude Code prompt for fixing confirmed review findings. |
| [prompts/claude-code/subagent-execution.md](prompts/claude-code/subagent-execution.md) | Subagent execution prompt for parallelizable work. |
| [prompts/claude-code/serial-checkpoint.md](prompts/claude-code/serial-checkpoint.md) | Serial checkpoint prompt when subagents are unavailable or unsuitable. |
| [prompts/common/checkpoint-artifact.md](prompts/common/checkpoint-artifact.md) | Prompt for writing resumable private workbench checkpoint artifacts. |
| [prompts/common/delivery-docs.md](prompts/common/delivery-docs.md) | Prompt for API, test, implementation, deployment, and handoff docs. |
| [prompts/common/html-artifact.md](prompts/common/html-artifact.md) | Prompt for optional HTML reading artifacts. |
| [prompts/common/skill-harness-audit.md](prompts/common/skill-harness-audit.md) | Prompt for deciding whether a workflow belongs in a script, skill, prompt, pack, or profile. |
| [prompts/common/workbench-tidy.md](prompts/common/workbench-tidy.md) | Prompt for organizing private workbench artifacts. |

### Releases

| Document | Purpose |
| --- | --- |
| [releases/release-evidence-template.md](releases/release-evidence-template.md) | Release or promotion evidence template. |
| [releases/release-validation-runbook.md](releases/release-validation-runbook.md) | Manual runbook for exact tag, isolated install smoke, workflow evaluation, and promotion decisions. |
| [releases/3.0.0-notes.md](releases/3.0.0-notes.md) | Prepared release notes and transparent v2.4.1 tag-history disclosure. |
| [releases/3.0.1-notes.md](releases/3.0.1-notes.md) | Immutable recovery release for the exact SBOM attestation path contract. |
| [releases/operator-recovery-and-key-rotation.md](releases/operator-recovery-and-key-rotation.md) | Independent candidate review, signing-key rotation, recovery drill, label sync, and adoption-evidence boundaries. |
| [examples/primary-workflow-transcript.md](examples/primary-workflow-transcript.md) | Exact canonical-input transcript and before/after shape for route plus the five primary workflow stages. |
| [releases/3.0.0-audit-closure.md](releases/3.0.0-audit-closure.md) | Audit finding closure matrix, intentional hook exception, and remaining external publication gates. |
| [releases/release-hygiene.md](releases/release-hygiene.md) | Version, tag, generated artifact, and pre-release hygiene rules. |

### Showcase

| Document | Purpose |
| --- | --- |
| [showcase/README.md](showcase/README.md) | Local index for scenario-based workflow examples. |
| [showcase/java-backend.md](showcase/java-backend.md) | Java backend workflow showcase with validation and private context boundary. |
| [showcase/frontend.md](showcase/frontend.md) | Frontend workflow showcase with UI state, accessibility, and screenshot validation boundaries. |
| [showcase/release-and-docs.md](showcase/release-and-docs.md) | Release and docs workflow showcase with version, generated-file, and validation evidence boundaries. |

### Workflows And Project State

| Document | Purpose |
| --- | --- |
| [workflows/context-safe-agent-workflows.md](workflows/context-safe-agent-workflows.md) | Large-task, review, fix, delivery, and checkpoint workflows. |
| [workflows/gsd-informed-hardening.md](workflows/gsd-informed-hardening.md) | Maintenance note for the GSD-informed routing, checkpoint, evidence, budget, and distribution-risk hardening. |
| [workflows/routing-validation-guardrails.md](workflows/routing-validation-guardrails.md) | Guardrails for first-stage routing, checkpoint evidence, surface budgets, and distribution-risk scanning. |
| [workflows/source-controlled-checks.md](workflows/source-controlled-checks.md) | Design note for source-controlled workflow checks and fixture validation boundaries. |
| [workflows/verification-evidence-contract.md](workflows/verification-evidence-contract.md) | Standards for mapping checks, checkpoints, and handoffs to verified behavior or facts. |
| [workflows/thin-harness-fat-skills.md](workflows/thin-harness-fat-skills.md) | Placement doctrine for scripts, skills, prompts, packs, and profiles. |
| [getting-started.md](getting-started.md) | Install, `/nova-plugin:route`, five primary commands, Codex prerequisites, and common failure handling. |
| [project-optimization-plan.md](project-optimization-plan.md) | Active optimization plan for positioning, reliability, usability, maintenance, and release readiness. |
| [llm-plugins-fusion-maintenance-status.md](llm-plugins-fusion-maintenance-status.md) | Context-safe maintenance snapshot for small-step optimization rounds. |

## Maintenance Rules

- Keep this file as navigation, not a second copy of the detailed guidance in
  leaf documents.
- Add or update a row here when an active document under `docs/` is added,
  moved, or retired.
- Keep generated files generated. `docs/marketplace/catalog.md` must be
  regenerated from `.claude-plugin/registry.source.json`, and
  `docs/generated/surface-inventory.*` must be regenerated with
  `node scripts/generate-surface-inventory.mjs --write`.
- Keep private consumer names, local paths, endpoints, credentials, repository
  addresses, and business rules out of public docs and prompts.
- For documentation-only edits, run:

```bash
node scripts/validate-docs.mjs
git diff --check
```

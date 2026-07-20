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
| Choose the shortest path by persona or task | [start-here.md](getting-started/README.md) |
| Get started quickly with `nova-plugin` | [getting-started.md](getting-started/first-workflow.md) |
| See scenario-based workflow examples | [showcase/README.md](tutorials/README.md) |
| Prepare social preview and demo capture assets | [assets/README.md](operations/community/assets.md) |
| Record a public-safe Java/Spring workflow | [Java/Spring recording guide](operations/community/java-spring-demo.md) |
| Track growth metrics and manual promotion channels | [growth/README.md](operations/community/metrics.md) |
| Collect consented external adoption evidence | [Adoption record template](templates/evidence/adoption-record.md) |
| Understand local audit logs and data handling | [privacy/data-handling.md](reference/security/data-handling.md) |
| Inspect generated public surface inventory | [generated/surface-inventory.md](generated/surface-inventory.md) |
| Browse generated task-oriented documentation navigation | [generated/documentation-navigation.md](generated/documentation-navigation.md) |
| Compare generated workflow command contracts | [generated/command-matrix.md](generated/command-matrix.md) |
| Adopt `nova-plugin` in a private project | [consumers/README.md](guides/assistants/README.md) |
| Maintain repository checks and release gates | [maintainers/quickstart.md](operations/maintainers/README.md) |
| Find the script, npm shortcut, or CI job for a maintenance task | [maintainers/task-catalog.md](operations/maintainers/validation.md) |
| Understand current compatibility evidence and boundaries | [compatibility/README.md](reference/compatibility/README.md) |
| Use the framework/compiler and llmf preview | [framework/README.md](reference/architecture/framework.md) |
| Understand assistant L1-L4 evidence claims | [compatibility/assistant-levels.md](reference/compatibility/assistant-levels.md) |
| Inspect reproducible workflow quality evidence | [quality/benchmark.md](reference/evaluation/benchmark.md) |
| Choose a nova command or inspect plugin docs | [../nova-plugin/docs/README.md](../nova-plugin/docs/README.md) |
| Understand core agents and capability pack routing | [agents/ROUTING.md](reference/architecture/agent-routing.md) |
| Reuse public-safe workflow prompts | [prompts/README.md](templates/prompts/README.md) |
| Split large agent work into resumable units | [workflows/context-safe-agent-workflows.md](guides/workflows/context-safe.md) |
| Review GSD-informed reliability hardening | [workflows/gsd-informed-hardening.md](guides/workflows/hardening.md) |
| Maintain routing and validation guardrails | [workflows/routing-validation-guardrails.md](reference/workflows/routing-guardrails.md) |
| Design source-controlled workflow checks | [workflows/source-controlled-checks.md](guides/workflows/source-controlled-checks.md) |
| Understand verification evidence standards | [workflows/verification-evidence-contract.md](reference/workflows/verification-evidence.md) |
| Maintain marketplace registry metadata | [marketplace/registry-author-workflow.md](operations/marketplace/registry-authoring.md) |
| Prepare release or promotion evidence | [releases/release-evidence-template.md](templates/evidence/release.md) |
| Run release validation manually | [releases/release-validation-runbook.md](operations/releases/validation.md) |
| Operate candidate-to-stable promotion from one checklist | [maintainers/release-runbook.md](operations/releases/runbook.md) |
| Review current project optimization work | [project-optimization-plan.md](project/plans/current-remediation.md) |
| Resume small-step maintenance rounds | [llm-plugins-fusion-maintenance-status.md](operations/maintainers/status.md) |

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
| [assets/README.md](operations/community/assets.md) | Social preview requirements, demo capture storyboard, and privacy boundary. |
| [operations/community/java-spring-demo.md](operations/community/java-spring-demo.md) | Capture-ready, public-safe Java/Spring workflow recording script and acceptance checklist. |

### Agents

| Document | Purpose |
| --- | --- |
| [agents/ROUTING.md](reference/architecture/agent-routing.md) | Current 6-core-agent routing and capability pack hints. |
| [agents/PLUGIN_AWARE_ROUTING.md](reference/architecture/agent-routing.md) | Enhanced/fallback mode and pack activation rules. |

### Consumers

| Document | Purpose |
| --- | --- |
| [consumers/README.md](guides/assistants/README.md) | Local index for consumer profile templates and public/private boundaries. |
| [consumers/profile-contract.md](templates/consumer-profiles/contract.md) | Required fields for public-safe consumer profiles. |
| [consumers/private-java-backend-template.md](templates/consumer-profiles/java-backend.md) | Redacted Java/Spring backend profile template. |
| [consumers/frontend-project-template.md](templates/consumer-profiles/frontend.md) | Redacted frontend project profile template. |
| [consumers/workbench-template.md](templates/consumer-profiles/workbench.md) | Private workbench structure for requirements, plans, reviews, prompts, and handoffs. |
| [consumers/cursor-setup.md](guides/assistants/cursor.md) | Cursor setup for consuming nova skills. |
| [consumers/cline-setup.md](guides/assistants/cline.md) | Cline setup for consuming nova skills. |
| [consumers/aider-setup.md](guides/assistants/aider.md) | Aider setup for consuming nova skills. |
| [consumers/openhands-setup.md](guides/assistants/openhands.md) | OpenHands setup for consuming nova skills. |
| [consumers/gemini-cli-setup.md](guides/assistants/gemini-cli.md) | Gemini CLI setup for consuming nova workflows. |
| [consumers/opencode-setup.md](guides/assistants/opencode.md) | OpenCode intent-to-skill routing notes. |
| [consumers/copilot-setup.md](guides/assistants/copilot.md) | GitHub Copilot instruction mapping. |
| [consumers/codex-setup.md](guides/assistants/codex.md) | Codex setup and Codex loop prerequisites. |

### Examples

| Document | Purpose |
| --- | --- |
| [examples/README.md](tutorials/README.md) | Local index for public-safe examples. |
| [examples/workflow-evaluation.md](tutorials/workflow-evaluation.md) | Five-stage workflow evaluation examples, fixture validation command, and rubric. |
| [examples/workflow-evaluation-record-template.md](templates/evidence/workflow-evaluation.md) | Manual evidence record template for workflow-quality checks. |
| [templates/evidence/adoption-record.md](templates/evidence/adoption-record.md) | Consented, redacted, digest-bound external adoption record template. |
| [examples/java-backend/redacted-feature.md](tutorials/java-backend.md) | Generic Java/Spring workflow example. |
| [examples/frontend/basic-feature.md](tutorials/frontend.md) | Generic frontend workflow example. |

### Growth

| Document | Purpose |
| --- | --- |
| [growth/README.md](operations/community/metrics.md) | Stars, forks, issues, PRs, releases, traffic metrics, collection cadence, and manual channel record. |

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
| [compatibility/public-api.md](reference/compatibility/public-api.md) | Stable commands, plugin identifiers, validation CLIs, generated file contracts, and breaking-change triggers. |
| [compatibility/assistant-levels.md](reference/compatibility/assistant-levels.md) | Evidence definitions for parseable, invocable, enforced, and verified assistant adapters. |
| [compatibility/contract-semver.md](reference/compatibility/contract-semver.md) | Independent Workflow IR, runtime contract, and adapter contract SemVer ranges and 4.x alias migration policy. |
| [framework/README.md](reference/architecture/framework.md) | Framework/compiler evidence, protocol sources, and llmf preview contract. |
| [framework/second-product.md](guides/framework/second-product.md) | Product-neutral specification, adapter, validation, build, and static eval guide. |
| [migrations/contract-v6.md](project/migrations/contract-v6.md) | Deterministic v5 to v6 migration and retained-alias decision. |

### Maintainers

| Document | Purpose |
| --- | --- |
| [maintainers/quickstart.md](operations/maintainers/README.md) | Maintainer change paths, default checks, timing evidence, and install smoke boundary. |
| [maintainers/validation-index.md](operations/maintainers/validation.md) | Maintainer validation command, CI check, and change-routing inventory. |
| [maintainers/troubleshooting.md](operations/maintainers/troubleshooting.md) | Common local validation, Bash, Claude CLI, hooks, audit log, and registry drift troubleshooting. |
| [operations/maintainers/diagnostics.md](operations/maintainers/diagnostics.md) | Generated diagnostic reason codes, status semantics, and remediation links. |
| [maintainers/github-security-settings.md](operations/maintainers/github-security.md) | Branch protection, ruleset, CodeQL, secret scanning, Dependabot, and required-check guidance. |
| [maintainers/post-remediation-audit.md](project/plans/current-remediation.md) | Current execution plan, post-remediation audit, evidence boundaries, residual risks, and phased ROI roadmap. |
| [maintainers/comprehensive-audit-remediation-plan.md](project/plans/current-remediation.md) | Complete remediation plan for the current 13-dimension audit, release hold enforcement, external evidence gates, API hardening, and final acceptance. |
| [maintainers/deep-research-remediation-and-documentation-redesign-plan.md](project/plans/current-remediation.md) | Proposed report-wide remediation plan and separate full documentation information-architecture redesign. |

### Marketplace

| Document | Purpose |
| --- | --- |
| [marketplace/catalog.md](marketplace/catalog.md) | Generated human-readable marketplace catalog. |
| [marketplace/registry-author-workflow.md](operations/marketplace/registry-authoring.md) | Author workflow for registry and marketplace entry maintenance. |
| [marketplace/compatibility-matrix.md](reference/compatibility/marketplace.md) | Compatibility matrix for Claude Code, Codex CLI, Bash, Node.js, and optional tools. |
| [migrations/2.4.1-command-namespace.md](project/migrations/2.4.1-command-namespace.md) | 2.4.1 namespaced invocation and 42-item dual-surface migration. |
| [migrations/3.0.0-adapters-and-direct-commands.md](project/migrations/3.0.0-adapters-and-direct-commands.md) | Node.js 22, direct command adapters, canonical workflow generation, and compatibility alias migration. |
| [marketplace/trust-policy.md](reference/security/marketplace-trust.md) | Trust, risk, deprecation, freshness, maintainer, and review metadata policy. |
| [marketplace/security-review-route.md](reference/security/security-review.md) | Security-sensitive marketplace change review route. |
| [marketplace/portal-information-architecture.md](project/plans/portal-information-architecture.md) | Deferred public portal information architecture. |
| [marketplace/multi-plugin-readiness.md](project/plans/multi-plugin-readiness.md) | Version-independent evidence ledger for production multi-plugin activation. |

### Privacy

| Document | Purpose |
| --- | --- |
| [privacy/data-handling.md](reference/security/data-handling.md) | Local audit log behavior, best-effort redaction boundary, disable switch, and public data handling rules. |

### Prompts

| Document | Purpose |
| --- | --- |
| [prompts/README.md](templates/prompts/README.md) | Local index and rules for public-safe prompt templates. |
| [prompts/codex/context-safe-review.md](templates/prompts/codex/context-safe-review.md) | Codex review prompt for bounded branch or working-tree review. |
| [prompts/codex/final-verification.md](templates/prompts/codex/final-verification.md) | Codex verification prompt after fixes exist. |
| [prompts/claude-code/fix-from-review.md](templates/prompts/claude-code/fix-from-review.md) | Claude Code prompt for fixing confirmed review findings. |
| [prompts/claude-code/subagent-execution.md](templates/prompts/claude-code/subagent-execution.md) | Subagent execution prompt for parallelizable work. |
| [prompts/claude-code/serial-checkpoint.md](templates/prompts/claude-code/serial-checkpoint.md) | Serial checkpoint prompt when subagents are unavailable or unsuitable. |
| [prompts/common/checkpoint-artifact.md](templates/prompts/common/checkpoint-artifact.md) | Prompt for writing resumable private workbench checkpoint artifacts. |
| [prompts/common/delivery-docs.md](templates/prompts/common/delivery-docs.md) | Prompt for API, test, implementation, deployment, and handoff docs. |
| [prompts/common/html-artifact.md](templates/prompts/common/html-artifact.md) | Prompt for optional HTML reading artifacts. |
| [prompts/common/skill-harness-audit.md](templates/prompts/common/skill-harness-audit.md) | Prompt for deciding whether a workflow belongs in a script, skill, prompt, pack, or profile. |
| [prompts/common/workbench-tidy.md](templates/prompts/common/workbench-tidy.md) | Prompt for organizing private workbench artifacts. |

### Releases

| Document | Purpose |
| --- | --- |
| [releases/release-evidence-template.md](templates/evidence/release.md) | Release or promotion evidence template. |
| [releases/release-validation-runbook.md](operations/releases/validation.md) | Manual runbook for exact tag, isolated install smoke, workflow evaluation, and promotion decisions. |
| [releases/3.0.0-notes.md](project/release-notes/3.0.0.md) | Prepared release notes and transparent v2.4.1 tag-history disclosure. |
| [releases/3.0.1-notes.md](project/release-notes/3.0.1.md) | Immutable recovery release for the exact SBOM attestation path contract. |
| [releases/operator-recovery-and-key-rotation.md](operations/releases/recovery-and-key-rotation.md) | Independent candidate review, signing-key rotation, recovery drill, label sync, and adoption-evidence boundaries. |
| [examples/primary-workflow-transcript.md](tutorials/first-workflow-transcript.md) | Exact canonical-input transcript and before/after shape for route plus the five primary workflow stages. |
| [releases/3.0.0-audit-closure.md](project/release-notes/3.0.0.md) | Audit finding closure matrix, intentional hook exception, and remaining external publication gates. |
| [releases/release-hygiene.md](operations/releases/hygiene.md) | Version, tag, generated artifact, and pre-release hygiene rules. |

### Showcase

| Document | Purpose |
| --- | --- |
| [showcase/README.md](tutorials/README.md) | Local index for scenario-based workflow examples. |
| [showcase/java-backend.md](tutorials/java-backend.md) | Java backend workflow showcase with validation and private context boundary. |
| [showcase/frontend.md](tutorials/frontend.md) | Frontend workflow showcase with UI state, accessibility, and screenshot validation boundaries. |
| [showcase/release-and-docs.md](tutorials/release-and-docs.md) | Release and docs workflow showcase with version, generated-file, and validation evidence boundaries. |

### Workflows And Project State

| Document | Purpose |
| --- | --- |
| [workflows/context-safe-agent-workflows.md](guides/workflows/context-safe.md) | Large-task, review, fix, delivery, and checkpoint workflows. |
| [workflows/gsd-informed-hardening.md](guides/workflows/hardening.md) | Maintenance note for the GSD-informed routing, checkpoint, evidence, budget, and distribution-risk hardening. |
| [workflows/routing-validation-guardrails.md](reference/workflows/routing-guardrails.md) | Guardrails for first-stage routing, checkpoint evidence, surface budgets, and distribution-risk scanning. |
| [workflows/source-controlled-checks.md](guides/workflows/source-controlled-checks.md) | Design note for source-controlled workflow checks and fixture validation boundaries. |
| [workflows/verification-evidence-contract.md](reference/workflows/verification-evidence.md) | Standards for mapping checks, checkpoints, and handoffs to verified behavior or facts. |
| [workflows/thin-harness-fat-skills.md](reference/architecture/skill-first-projection.md) | Placement doctrine for scripts, skills, prompts, packs, and profiles. |
| [reference/architecture/control-plane.md](reference/architecture/control-plane.md) | One-page map of plugin runtime, maintainer control plane, generated projections, and external evidence. |
| [getting-started.md](getting-started/first-workflow.md) | Install, `/nova-plugin:route`, five primary commands, Codex prerequisites, and common failure handling. |
| [project/plans/deep-research-engineering-risk-execution-plan.md](project/plans/deep-research-engineering-risk-execution-plan.md) | Locally implemented report-wide engineering-risk plan; external CI, performance-history, and credentialed evidence gates remain active. |
| [project-optimization-plan.md](project/plans/current-remediation.md) | Active optimization plan for positioning, reliability, usability, maintenance, and release readiness. |
| [llm-plugins-fusion-maintenance-status.md](operations/maintainers/status.md) | Context-safe maintenance snapshot for small-step optimization rounds. |

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

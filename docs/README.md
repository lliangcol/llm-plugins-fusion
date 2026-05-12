# Repository Documentation Index

Status: active
Date: 2026-05-12

This is the repository-level map for public documentation under `docs/`.
Use [nova-plugin/docs/README.md](../nova-plugin/docs/README.md) for
plugin-specific user docs, command docs, and current architecture notes.

Detailed local indexes remain in subdirectories that need them, such as
`docs/consumers/`, `docs/examples/`, and `docs/prompts/`. This page owns the
directory-level navigation for `docs/` so the root README does not need to
duplicate every document.

## Start Here

| Need | Entry |
| --- | --- |
| Get started quickly with `nova-plugin` | [getting-started.md](getting-started.md) |
| Adopt `nova-plugin` in a private project | [consumers/README.md](consumers/README.md) |
| Choose a nova command or inspect plugin docs | [../nova-plugin/docs/README.md](../nova-plugin/docs/README.md) |
| Understand core agents and capability pack routing | [agents/ROUTING.md](agents/ROUTING.md) |
| Reuse public-safe workflow prompts | [prompts/README.md](prompts/README.md) |
| Split large agent work into resumable units | [workflows/context-safe-agent-workflows.md](workflows/context-safe-agent-workflows.md) |
| Review GSD-informed reliability hardening | [workflows/gsd-informed-hardening.md](workflows/gsd-informed-hardening.md) |
| Maintain routing and validation guardrails | [workflows/routing-validation-guardrails.md](workflows/routing-validation-guardrails.md) |
| Understand verification evidence standards | [workflows/verification-evidence-contract.md](workflows/verification-evidence-contract.md) |
| Maintain marketplace registry metadata | [marketplace/registry-author-workflow.md](marketplace/registry-author-workflow.md) |
| Prepare release or promotion evidence | [releases/release-evidence-template.md](releases/release-evidence-template.md) |
| Run release validation manually | [releases/release-validation-runbook.md](releases/release-validation-runbook.md) |
| Review current project optimization work | [project-optimization-plan.md](project-optimization-plan.md) |

## Directory Map

```text
docs/
|-- README.md
|-- getting-started.md              # shortest install and workflow entry
|-- agents/                       # core agent routing and pack routing
|-- consumers/                    # public-safe consumer profile contracts and setup templates
|-- examples/                     # redacted workflow examples and evaluation templates
|-- marketplace/                  # generated catalog, registry workflow, trust, compatibility, and review docs
|-- prompts/                      # reusable public-safe prompt templates
|-- releases/                     # release evidence templates, runbooks, and hygiene docs
|-- workflows/                    # reusable agent workflow guidance
`-- project-optimization-plan.md  # active project optimization plan
```

## Directory Responsibilities

| Area | Owns |
| --- | --- |
| [agents/](agents/) | Core agent routing and plugin-aware routing. |
| [consumers/](consumers/) | Public-safe consumer profile contracts, redacted project templates, and cross-tool setup notes. |
| [examples/](examples/) | Redacted Java backend/frontend examples and workflow evaluation templates. |
| [marketplace/](marketplace/) | Marketplace catalog output, registry author workflow, compatibility, trust, security review, and v3 readiness evidence. |
| [prompts/](prompts/) | Copyable prompt templates for Codex, Claude Code, delivery docs, HTML artifacts, and workbench cleanup. |
| [releases/](releases/) | Release evidence templates, validation runbooks, and release hygiene rules. |
| [workflows/](workflows/) | Context-safe agent workflows, routing/validation guardrails, and the thin-harness/fat-skills placement doctrine. |

## Current Documents

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
| [consumers/gemini-cli-setup.md](consumers/gemini-cli-setup.md) | Gemini CLI setup for consuming nova workflows. |
| [consumers/opencode-setup.md](consumers/opencode-setup.md) | OpenCode intent-to-skill routing notes. |
| [consumers/copilot-setup.md](consumers/copilot-setup.md) | GitHub Copilot instruction mapping. |
| [consumers/codex-setup.md](consumers/codex-setup.md) | Codex setup and Codex loop prerequisites. |

### Examples

| Document | Purpose |
| --- | --- |
| [examples/README.md](examples/README.md) | Local index for public-safe examples. |
| [examples/workflow-evaluation.md](examples/workflow-evaluation.md) | Five-stage workflow evaluation examples and rubric. |
| [examples/workflow-evaluation-record-template.md](examples/workflow-evaluation-record-template.md) | Manual evidence record template for workflow-quality checks. |
| [examples/java-backend/redacted-feature.md](examples/java-backend/redacted-feature.md) | Generic Java/Spring workflow example. |
| [examples/frontend/basic-feature.md](examples/frontend/basic-feature.md) | Generic frontend workflow example. |

### Marketplace

| Document | Purpose |
| --- | --- |
| [marketplace/catalog.md](marketplace/catalog.md) | Generated human-readable marketplace catalog. |
| [marketplace/registry-author-workflow.md](marketplace/registry-author-workflow.md) | Author workflow for registry and marketplace entry maintenance. |
| [marketplace/compatibility-matrix.md](marketplace/compatibility-matrix.md) | Compatibility matrix for Claude Code, Codex CLI, Bash, Node.js, and optional tools. |
| [marketplace/trust-policy.md](marketplace/trust-policy.md) | Trust, risk, deprecation, freshness, maintainer, and review metadata policy. |
| [marketplace/security-review-route.md](marketplace/security-review-route.md) | Security-sensitive marketplace change review route. |
| [marketplace/portal-information-architecture.md](marketplace/portal-information-architecture.md) | Deferred public portal information architecture. |
| [marketplace/v3-readiness-evidence.md](marketplace/v3-readiness-evidence.md) | Evidence ledger for whether v3 multi-plugin or portal work should start. |

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
| [releases/release-hygiene.md](releases/release-hygiene.md) | Version, tag, generated artifact, and pre-release hygiene rules. |

### Workflows And Project State

| Document | Purpose |
| --- | --- |
| [workflows/context-safe-agent-workflows.md](workflows/context-safe-agent-workflows.md) | Large-task, review, fix, delivery, and checkpoint workflows. |
| [workflows/gsd-informed-hardening.md](workflows/gsd-informed-hardening.md) | Maintenance note for the GSD-informed routing, checkpoint, evidence, budget, and distribution-risk hardening. |
| [workflows/routing-validation-guardrails.md](workflows/routing-validation-guardrails.md) | Guardrails for first-stage routing, checkpoint evidence, surface budgets, and distribution-risk scanning. |
| [workflows/verification-evidence-contract.md](workflows/verification-evidence-contract.md) | Standards for mapping checks, checkpoints, and handoffs to verified behavior or facts. |
| [workflows/thin-harness-fat-skills.md](workflows/thin-harness-fat-skills.md) | Placement doctrine for scripts, skills, prompts, packs, and profiles. |
| [getting-started.md](getting-started.md) | Install, `/route`, five primary commands, Codex prerequisites, and common failure handling. |
| [project-optimization-plan.md](project-optimization-plan.md) | Active optimization plan for positioning, reliability, usability, maintenance, and release readiness. |

## Maintenance Rules

- Keep this file as navigation, not a second copy of the detailed guidance in
  leaf documents.
- Add or update a row here when an active document under `docs/` is added,
  moved, or retired.
- Keep generated files generated. `docs/marketplace/catalog.md` must be
  regenerated from `.claude-plugin/registry.source.json`.
- Keep private consumer names, local paths, endpoints, credentials, repository
  addresses, and business rules out of public docs and prompts.
- For documentation-only edits, run:

```bash
node scripts/validate-docs.mjs
git diff --check
```

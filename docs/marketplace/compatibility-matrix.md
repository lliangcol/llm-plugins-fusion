# Compatibility Matrix

Status: active
Date: 2026-07-12

This matrix records the runtime and maintenance prerequisites for marketplace
entries. It is the compatibility evidence target referenced by
`.claude-plugin/registry.source.json` and generated into
`docs/marketplace/catalog.md`.

## Evidence Scope Boundary

This matrix records compatibility evidence for the current `nova-plugin` entry
and registry fixture behavior. It is not a hosted public portal, paid
marketplace, runtime dynamic loading contract, or proof that production
multi-plugin migration is active.

Optional enhanced tools remain optional. If a tool is unavailable, record the
check as unavailable, skipped, or pending with replacement evidence instead of
broadening permissions or treating the missing tool as passed.

Compatibility evidence must stay public-safe: cite sanitized docs, scripts, and
check outputs, not private consumer paths, endpoints, credentials, repository
addresses, runtime flags, business rules, customer data, or private
knowledge-base content.

## Tooling Prerequisites

Assistant compatibility uses four evidence levels: L1 parseable, L2 invocable,
L3 enforced, and L4 verified. A level applies only to the exact adapter and
evidence named below; Markdown portability alone is L1, not proof of equivalent
runtime safety.

<!-- generated:assistant-compatibility:start -->
| Assistant | Effective current level | Maximum | Evidence state | Claim boundary |
| --- | --- | --- | --- | --- |
| claude-code | L2 | L4 | declaration-only | stable Claude command invocation; hooks and release verification require current evidence |
| codex | L2 | L4 | declaration-only | generated local adapter; enforcement and live behavior require current evidence |
| generic | L1 | L4 | declaration-only | parseable contracts only; consumer owns invocation and enforcement |
<!-- generated:assistant-compatibility:end -->

Other assistants such as Cursor, Gemini CLI, OpenCode, Copilot, Aider, Cline,
and OpenHands remain L1 unless a separate versioned adapter and current evidence
record exists. Consumer setup guidance is not live conformance proof.

| Surface | Requirement | Evidence | Notes |
| --- | --- | --- | --- |
| Claude Code marketplace install | Claude Code plugin marketplace support | `node scripts/validate-claude-compat.mjs` and live `claude plugin validate` when CLI is installed | Repository-local metadata must stay out of `.claude-plugin/marketplace.json`. |
| Nova commands and skills | 21 generated commands and 6 canonical `nova-*` skills | `node scripts/lint-frontmatter.mjs` | Fifteen deprecated aliases contain only canonical-skill and preset projection; command docs remain covered by `node scripts/validate-docs.mjs`. |
| Codex review/fix/verify loop | Codex CLI plus Bash 3.2+ for distributed skill scripts | `nova-plugin/docs/commands/codex/`, `nova-plugin/skills/nova-codex-review-fix/scripts/`, and `node scripts/validate-runtime-smoke.mjs` | Codex runtime artifacts under `.codex/` are never committed. Review/verify runs record runtime environment artifacts with CLI paths and versions. If Codex CLI is unavailable, use the ordinary `/nova-plugin:review` -> `/nova-plugin:implement-plan` path instead. |
| Repository validation | Node.js 22+ | `node scripts/validate-all.mjs`, including `node scripts/validate-runtime-smoke.mjs` and `node scripts/scan-distribution-risk.mjs` | Validation scripts use built-in Node.js APIs and repository files. |
| GitHub workflow contracts | Node.js 22+ | `node scripts/validate-github-workflows.mjs` | Covers least-privilege workflow token scope, `.github/workflows/` inventory, required-check docs/read-only print output synchronization, and isolated mutating install smoke boundaries. |
| Prompt-surface budgets | Node.js 22+ | `node scripts/validate-surface-budget.mjs` | Budget checks are a prompt bloat guard, not a feature-quality metric. |
| Active write guard | Node.js 22+ and Bash 3.2+ | `node scripts/validate-runtime-smoke.mjs` | PreToolUse uses exec-form Bash launchers so missing Node fails closed with exit 2; Node owns guard logic. PostToolUse uses direct Node exec form. Existing targets must be regular single-link files. Hooks are not an atomic filesystem sandbox and PostToolUse cannot roll back a completed write. NotebookEdit fails closed. `NOVA_WRITE_GUARD_DISABLED=1` is not release evidence. |
| Hook syntax checks | Bash 3.2+ on PATH | `bash -n nova-plugin/hooks/scripts/pre-write-check.sh`, `bash -n nova-plugin/hooks/scripts/pre-bash-check.sh`, and `bash -n nova-plugin/hooks/scripts/post-audit-log.sh` | Windows without Bash may warning-skip local syntax checks; CI/Linux and CI/Windows Bash smoke must run them. |
| Windows maintenance smoke | Windows runner with Node.js 22, PowerShell, and Git Bash | CI `Platform / windows` matrix lane | Node/PowerShell checks run alongside explicit Bash capability evidence; unsupported link-count semantics fail closed and are reported by doctor. |
| Optional enhanced tools | Installed plugins or tools named by capability packs | `docs/agents/PLUGIN_AWARE_ROUTING.md` and `nova-plugin/packs/` | Enhanced mode is optional; fallback mode must remain documented. |

## Current Plugin Evidence

| Plugin | Commands | Skills | Docs | Validation | Known prerequisites |
| --- | --- | --- | --- | --- | --- |
| `nova-plugin` | [nova-plugin/commands/](../../nova-plugin/commands/) | [nova-plugin/skills/](../../nova-plugin/skills/) | [nova-plugin/docs/README.md](../../nova-plugin/docs/README.md) | [scripts/validate-all.mjs](../../scripts/validate-all.mjs) | Claude Code for read-only use; Node.js 22+ and Bash 3.2+ for active Write/Edit guard; Codex CLI for Codex loop commands. |

## Evidence Rules

- Each registry entry must declare `compatibility.commands`,
  `compatibility.skills`, `compatibility.docs`, `compatibility.validation`, and
  `compatibility.prerequisites`.
- The evidence may point to a directory when the coverage is structural, such
  as command and skill inventories.
- Validation evidence should name the script or check suite reviewers can run
  locally.
- GitHub workflow evidence should include `node scripts/validate-github-workflows.mjs`
  when CI/release workflows, workflow inventory, or required-check guidance
  changes.
- Surface budget evidence prevents prompt growth from becoming invisible; it
  does not prove workflow output quality.
- Release evidence must include distribution risk scan output before public
  promotion or artifact publishing.
- Prerequisite evidence should state optional tools separately from required
  install/runtime tools.
- If a plugin has no command or skill surface, the entry must still point to a
  document that explains that scope explicitly.

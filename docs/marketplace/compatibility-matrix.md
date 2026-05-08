# Compatibility Matrix

Status: active
Date: 2026-05-08

This matrix records the runtime and maintenance prerequisites for marketplace
entries. It is the compatibility evidence target referenced by
`.claude-plugin/registry.source.json` and generated into
`docs/marketplace/catalog.md`.

## Tooling Prerequisites

| Surface | Requirement | Evidence | Notes |
| --- | --- | --- | --- |
| Claude Code marketplace install | Claude Code plugin marketplace support | `node scripts/validate-claude-compat.mjs` and live `claude plugin validate` when CLI is installed | Repository-local metadata must stay out of `.claude-plugin/marketplace.json`. |
| Nova commands and skills | 20 commands and 20 one-to-one `nova-*` skills | `node scripts/lint-frontmatter.mjs` | Command docs remain covered by `node scripts/validate-docs.mjs`. |
| Codex review/fix/verify loop | Codex CLI plus Bash for distributed skill scripts | `nova-plugin/docs/commands/codex/` and `nova-plugin/skills/nova-codex-review-fix/scripts/` | Codex runtime artifacts under `.codex/` are never committed. |
| Repository validation | Node.js 20+ | `node scripts/validate-all.mjs` | Validation scripts use built-in Node.js APIs and repository files. |
| Hook syntax checks | Bash on PATH | `bash -n nova-plugin/hooks/scripts/pre-write-check.sh` and `bash -n nova-plugin/hooks/scripts/post-audit-log.sh` | Windows without Bash may warning-skip local syntax checks; CI/Linux must run them. |
| Optional enhanced tools | Installed plugins or tools named by capability packs | `docs/agents/PLUGIN_AWARE_ROUTING.md` and `nova-plugin/packs/` | Enhanced mode is optional; fallback mode must remain documented. |

## Current Plugin Evidence

| Plugin | Commands | Skills | Docs | Validation | Known prerequisites |
| --- | --- | --- | --- | --- | --- |
| `nova-plugin` | [nova-plugin/commands/](../../nova-plugin/commands/) | [nova-plugin/skills/](../../nova-plugin/skills/) | [nova-plugin/docs/README.md](../../nova-plugin/docs/README.md) | [scripts/validate-all.mjs](../../scripts/validate-all.mjs) | Claude Code for plugin use; Node.js 20+ for maintenance; Codex CLI and Bash only for Codex loop commands. |

## Evidence Rules

- Each registry entry must declare `compatibility.commands`,
  `compatibility.skills`, `compatibility.docs`, `compatibility.validation`, and
  `compatibility.prerequisites`.
- The evidence may point to a directory when the coverage is structural, such
  as command and skill inventories.
- Validation evidence should name the script or check suite reviewers can run
  locally.
- Prerequisite evidence should state optional tools separately from required
  install/runtime tools.
- If a plugin has no command or skill surface, the entry must still point to a
  document that explains that scope explicitly.

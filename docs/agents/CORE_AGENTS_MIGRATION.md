# Core Agents Migration

This document records how the former active specialist set maps to the six core agents and capability packs. It does not copy or modify archived agent content.

Historical archive details remain in [MIGRATION_MANIFEST.md](MIGRATION_MANIFEST.md). Current routing is defined in [ROUTING.md](ROUTING.md) and [PLUGIN_AWARE_ROUTING.md](PLUGIN_AWARE_ROUTING.md).

## Migration Summary

| Former active agent | Replacement core route | Capability pack route |
| --- | --- | --- |
| `api-design` | `architect`, `reviewer`, `publisher` | `docs`, `marketplace`, `frontend` when API docs touch those surfaces |
| `build-deps` | `builder`, `reviewer`, `verifier` | `dependency` |
| `data-analytics` | `architect`, `reviewer`, `publisher` | No dedicated pack; use project analytics docs and validation scripts |
| `db-engineer` | `architect`, `builder`, `reviewer`, `verifier` | No dedicated pack; use project DB docs, migrations, and tests |
| `devops-platform` | `architect`, `builder`, `verifier` | `release`, `dependency`, `mcp` when relevant |
| `git-release-manager` | `publisher`, `verifier`, `orchestrator` | `release` |
| `incident-responder` | `orchestrator`, `reviewer`, `verifier`, `publisher` | `security`, `release`, or project ops docs as applicable |
| `java-backend-engineer` | `architect`, `builder`, `reviewer`, `verifier` | `java`, plus `dependency` when build files change |
| `orchestrator` | `orchestrator` | Selects packs per task |
| `quality-engineer` | `reviewer`, `verifier` | Domain packs from touched files |
| `refactoring-specialist` | `architect`, `builder`, `reviewer`, `verifier` | `java`, `frontend`, `mcp`, or project-specific context |
| `security-audit` | `reviewer`, `verifier`, `publisher` | `security`, `docs` |
| `security-engineer` | `architect`, `builder`, `reviewer`, `verifier` | `security` |
| `test-automator` | `verifier`, `builder` | `java`, `frontend`, or project-specific test context |

## Compatibility Note

If active agent names are treated as a public compatibility commitment, this consolidation should be considered a major version impact. If active agent names are internal implementation details, it is still at least a minor capability change because packs and validation gates are added.

## Validation

- Active directory: `nova-plugin/agents/`
- Expected core files: `architect.md`, `builder.md`, `orchestrator.md`, `publisher.md`, `reviewer.md`, `verifier.md`
- Agent validation: `bash scripts/verify-agents.sh` or `.\scripts\verify-agents.ps1`
- Pack validation: `node scripts/validate-packs.mjs`

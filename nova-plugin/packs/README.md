# Capability Packs

Capability packs document domain-specific routing, inputs, checks, enhanced tools, and fallback behavior for the six core agents. They do not implement runtime dynamic loading; agents use them as optional guidance when a task matches the domain.

Every pack must support two modes:

- Enhanced mode: optional installed plugins, tools, or repository scripts add stronger analysis or validation.
- Fallback mode: the same task remains possible through source inspection, project metadata, local commands, and documented checklists.

## Pack Index

| Pack | Purpose | Primary Agents |
| --- | --- | --- |
| [java](java/) | Java, Spring, Maven, and Gradle work | `architect`, `builder`, `reviewer`, `verifier` |
| [security](security/) | Security review, hardening, and static scanning | `architect`, `reviewer`, `verifier` |
| [dependency](dependency/) | Dependency upgrades, vulnerabilities, and supply-chain risk | `builder`, `reviewer`, `verifier` |
| [docs](docs/) | README, CLAUDE.md, and technical documentation structure | `publisher`, `reviewer`, `verifier` |
| [release](release/) | CHANGELOG, versioning, session reports, and handoff notes | `publisher`, `verifier`, `orchestrator` |
| [marketplace](marketplace/) | Plugin and marketplace schemas, registry, and metadata | `architect`, `builder`, `verifier`, `publisher` |
| [frontend](frontend/) | Portal or registry UI, accessibility, and interaction quality | `architect`, `builder`, `reviewer`, `verifier` |
| [mcp](mcp/) | MCP configuration, server/client examples, and tool integration | `architect`, `builder`, `reviewer`, `verifier` |

## Maintenance

- Keep this index in sync with `nova-plugin/packs/*/README.md`.
- Keep pack routing in sync with [plugin-aware routing](../../docs/agents/PLUGIN_AWARE_ROUTING.md).
- Run `node scripts/validate-packs.mjs` after changing pack docs or routing references.

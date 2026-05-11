# Plugin-Aware Routing

`nova-plugin` routes work through six core agents and optional capability packs. Packs are documentation and validation guidance only; first-phase routing does not dynamically load pack runtimes.

Installed plugins, MCP tools, language servers, or scanners may improve a task's analysis. They are enhancements, not hard dependencies. Every route must remain executable in fallback mode.

## Core Agent Selection

| Task Type | Core Agent | Output Focus |
| --- | --- | --- |
| Ambiguous ownership, multi-domain work, missing inputs | `orchestrator` | Task breakdown, agent and pack route, verification plan |
| Architecture, design, API shape, migration, boundaries | `architect` | Decision, design, risk, migration plan |
| Implementation, refactor, integration, project edits | `builder` | Changed files, verification, residual risk |
| Code, design, security, or quality review | `reviewer` | Prioritized findings, questions, test gaps |
| Tests, scans, CI, static analysis, validation gates | `verifier` | Commands, results, failures, environment notes |
| README, docs, CHANGELOG, release notes, handoff | `publisher` | Documentation changes, release notes, compatibility |

## Pack Activation

| Trigger | Pack | Enhanced Mode | Fallback Mode |
| --- | --- | --- | --- |
| Java, Spring, Maven, Gradle | [java](../../nova-plugin/packs/java/) | Use `jdtls-lsp` when available for Java understanding, diagnostics, references, and edit support. | Use source files, build files, test commands, compiler output, and repository conventions. |
| Security, secrets, auth, hardening, OWASP, compliance | [security](../../nova-plugin/packs/security/) | Use `semgrep` or `security-guidance` when available for static analysis and checklist coverage. | Use manual security review, project scripts, dependency metadata, and documented security checklists. |
| Dependency upgrade, CVE, lockfile, supply chain | [dependency](../../nova-plugin/packs/dependency/) | Use `sonatype-guide` when available for dependency intelligence and remediation guidance. | Use lockfiles, package/build metadata, public ecosystem rules, local audit commands, and tests. |
| README, CLAUDE.md, AGENTS.md, docs structure | [docs](../../nova-plugin/packs/docs/) | Use `claude-md-management` or `document-skills` when available for consistency and document review. | Use Markdown link validation, structure review, source-of-truth files, and docs validators. |
| Official documentation grounding, source-driven framework guidance | [docs](../../nova-plugin/packs/docs/) plus the relevant domain pack | Use available documentation or MCP tools when they provide authoritative source lookup. | Use official docs, pinned versions, local source files, and explicit unverified-claim notes. |
| CHANGELOG, versioning, release notes, handoff | [release](../../nova-plugin/packs/release/) | Use `session-report` when available for structured handoff and session summaries. | Use repository changelog, release workflow, validation results, and final summary. |
| Deprecation, migration, rollout, rollback, compatibility window | [release](../../nova-plugin/packs/release/) | Use release/session tooling when available for structured migration evidence. | Use changelog, compatibility docs, rollout notes, rollback plan, and validation evidence. |
| Plugin metadata, marketplace schema, registry | [marketplace](../../nova-plugin/packs/marketplace/) | Use nova repository scripts and schemas for manifest and compatibility validation. | Use schema validators, documented metadata rules, and manual JSON review. |
| Portal or registry UI, accessibility, interaction | [frontend](../../nova-plugin/packs/frontend/) | Use the host project's existing frontend stack, preview server, tests, and accessibility tools when present. | Use existing files, manual QA checklists, responsive reasoning, and documentation constraints. |
| MCP config, server/client examples, tool integration | [mcp](../../nova-plugin/packs/mcp/) | Use available MCP tools or plugins for discovery, schema understanding, and integration checks. | Use `.mcp.json`, docs, schema checks, config review, and manual permission reasoning. |

## Routing Patterns

| Request | Core Route | Pack Route |
| --- | --- | --- |
| "Design a Spring Boot endpoint and migration plan." | `architect` | [java](../../nova-plugin/packs/java/) |
| "Implement the approved backend plan." | `builder` | [java](../../nova-plugin/packs/java/) and [dependency](../../nova-plugin/packs/dependency/) if build files change |
| "Review this PR for security and maintainability." | `reviewer` | [security](../../nova-plugin/packs/security/) plus domain packs from touched files |
| "Run local validation and explain failures." | `verifier` | Packs selected by failing commands |
| "Update README, CHANGELOG, and release handoff." | `publisher` | [docs](../../nova-plugin/packs/docs/) and [release](../../nova-plugin/packs/release/) |
| "Verify this framework guidance against official docs." | `reviewer` or `architect` | [docs](../../nova-plugin/packs/docs/) plus the relevant domain pack |
| "Cross-check this high-confidence security-sensitive decision." | `reviewer` | [security](../../nova-plugin/packs/security/) plus relevant domain packs |
| "Plan a deprecation or migration path." | `architect` then `publisher` | [release](../../nova-plugin/packs/release/) and [docs](../../nova-plugin/packs/docs/) |
| "Marketplace schema validation failed." | `verifier` then `builder` | [marketplace](../../nova-plugin/packs/marketplace/) |
| "Registry portal has layout and accessibility issues." | `reviewer` then `builder` | [frontend](../../nova-plugin/packs/frontend/) |
| "Add MCP server setup docs." | `architect` then `publisher` | [mcp](../../nova-plugin/packs/mcp/) and [docs](../../nova-plugin/packs/docs/) |

## Enhancement Rules

1. Treat installed plugins as optional accelerators.
2. State which enhanced tool was used, if any.
3. If an enhanced tool is unavailable, continue in fallback mode and record the limitation.
4. Do not require the host project to install extra plugins to use `nova-plugin`.
5. Do not add runtime dynamic loading until a later design explicitly introduces it.

## Fallback Requirements

Every routed task should still identify:

- The owning core agent.
- The applicable pack or "no dedicated pack".
- The local files, metadata, scripts, or checklists used as fallback evidence.
- The validation commands that passed, failed, or were skipped.

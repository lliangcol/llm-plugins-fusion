<!-- migrated-from: docs/agents/ROUTING.md -->
# Agent Routing (Core Agents)

Active agents live in `nova-plugin/agents/`. The active set is six core agents
plus documentation-only capability packs in `nova-plugin/packs/`. Retired
specialist-agent archive docs are not part of the current documentation
surface.

## Active Agents

| Agent | Responsibility |
| --- | --- |
| `orchestrator` | Decompose work, choose core agents and packs, merge results, and identify missing inputs. |
| `architect` | Own architecture options, boundaries, risks, migration plans, and technical decisions. |
| `builder` | Implement, refactor, and integrate scoped project changes. |
| `reviewer` | Review code, design, security, and quality with prioritized findings. |
| `verifier` | Run tests, static checks, dependency checks, and local or CI validation gates. |
| `publisher` | Maintain README, docs, CHANGELOG, release notes, and handoff artifacts. |

## Capability Packs

Capability packs are optional routing context, not runtime-loaded agents. The routing and fallback behavior is defined in this canonical page.

| Pack | Use For |
| --- | --- |
| `java` | Java, Spring, Maven, Gradle. |
| `security` | Security review, hardening, static scanning. |
| `dependency` | Dependency upgrades, vulnerabilities, supply-chain risk. |
| `docs` | README, CLAUDE.md, AGENTS.md, technical docs. |
| `release` | CHANGELOG, version strategy, session reports, handoff. |
| `marketplace` | Plugin and marketplace schemas, registry metadata. |
| `frontend` | Host-project portal or registry UI, deferred portal IA review, accessibility, interaction quality. |
| `mcp` | MCP config, server/client examples, tool integration. |

## Keyword Routing Table

| Keyword / smell | Route to | Pack hints |
| --- | --- | --- |
| "which agent", "route", ambiguous owner, multi-domain | `orchestrator` | Any relevant pack |
| architecture, API shape, migration, boundaries, tradeoffs | `architect` | `java`, `security`, `marketplace`, `frontend`, `mcp` |
| implement, fix, refactor, integrate, update files | `builder` | `java`, `dependency`, `frontend`, `marketplace`, `mcp` |
| review, audit, PR feedback, quality, security, maintainability | `reviewer` | `security`, `dependency`, `java`, `frontend`, `marketplace`, `mcp` |
| tests, validation, CI, static checks, scan, verify | `verifier` | `dependency`, `security`, `java`, `frontend`, `marketplace`, `release`, `mcp` |
| README, docs, changelog, release notes, handoff | `publisher` | `docs`, `release`, `marketplace`, `mcp` |

## Common Task Examples

1. "Spring Boot 新增接口并生成 OpenAPI 文档" -> `architect` then `builder`, with `java` and possibly `docs`.
2. "帮我评审这次 PR: 安全/性能/可维护性" -> `reviewer`, with `security` and domain packs as needed.
3. "CI 挂了: 依赖冲突/lockfile 变更导致构建失败" -> `verifier` then `builder`, with `dependency`.
4. "发布流程: 版本号、tag、changelog、hotfix 怎么做" -> `publisher` and `verifier`, with `release`.
5. "线上 5xx 激增，需要止血/回滚/定位" -> `orchestrator` routes triage to `reviewer` and validation to `verifier`.
6. "SQL 慢查询，给索引建议并解释原因" -> `architect` for design and `reviewer` for risk; use project-specific docs because no dedicated DB pack exists.
7. "定义留存/转化漏斗口径并做分析建议" -> `architect` for definitions and `publisher` for documentation; use project-specific analytics context.
8. "做一次 secrets/auth/config 的安全加固建议" -> `reviewer` and `architect`, with `security`.
9. "做 SOC2/ISO 审计清单和证据收集表" -> `reviewer` and `publisher`, with `security` and `docs`.
10. "大型重构: 模块拆分，降低耦合" -> `architect` then `builder`, with relevant domain packs.
11. "补测试: 提升覆盖率并修复 flaky" -> `verifier` then `builder`, with relevant domain packs.
12. "部署/环境/容器/CI/CD/平台治理问题" -> `architect`, `builder`, and `verifier`; use `release`, `dependency`, or `mcp` when relevant.
13. "不确定该从哪个 nova 命令开始" -> use `/nova-plugin:route` / `nova-route` first; it is the read-only first-stage router for command, skill, core agent, packs, required inputs, validation, and fallback path.
14. "按官方文档核对框架用法" -> `reviewer` or `architect`, with `docs` plus the relevant domain pack.
15. "高风险结论需要反向验证" -> `reviewer`, with `security` or the relevant domain pack.
16. "迁移、废弃、兼容窗口和回滚策略" -> `architect` then `publisher`, with `release` and `docs`.

## How `orchestrator` Delegates

1. Read the user request and detect domain smells.
2. Split into 1-5 subtasks, each with one owning core agent.
3. Attach one or more capability packs when domain rules apply.
4. Ask only for missing inputs that block safe routing.
5. Define deliverables, validation commands, enhanced mode, and fallback mode for the whole work.

<!-- merged-from: docs/agents/PLUGIN_AWARE_ROUTING.md -->
<details>
<summary>Migrated source: docs/agents/PLUGIN_AWARE_ROUTING.md</summary>

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
| Java, Spring, Maven, Gradle | [java](../../../nova-plugin/packs/java) | Use `jdtls-lsp` when available for Java understanding, diagnostics, references, and edit support. | Use source files, build files, test commands, compiler output, and repository conventions. |
| Security, secrets, auth, hardening, OWASP, compliance | [security](../../../nova-plugin/packs/security) | Use `semgrep` or `security-guidance` when available for static analysis and checklist coverage. | Use manual security review, project scripts, dependency metadata, and documented security checklists. |
| Dependency upgrade, CVE, lockfile, supply chain | [dependency](../../../nova-plugin/packs/dependency) | Use `sonatype-guide` when available for dependency intelligence and remediation guidance. | Use lockfiles, package/build metadata, public ecosystem rules, local audit commands, and tests. |
| README, CLAUDE.md, AGENTS.md, docs structure | [docs](../../../nova-plugin/packs/docs) | Use `claude-md-management` or `document-skills` when available for consistency and document review. | Use Markdown link validation, structure review, source-of-truth files, and docs validators. |
| Official documentation grounding, source-driven framework guidance | [docs](../../../nova-plugin/packs/docs) plus the relevant domain pack | Use available documentation or MCP tools when they provide authoritative source lookup. | Use official docs, pinned versions, local source files, and explicit unverified-claim notes. |
| CHANGELOG, versioning, release notes, handoff | [release](../../../nova-plugin/packs/release) | Use `session-report` when available for structured handoff and session summaries. | Use repository changelog, release workflow, validation results, and final summary. |
| Deprecation, migration, rollout, rollback, compatibility window | [release](../../../nova-plugin/packs/release) | Use release/session tooling when available for structured migration evidence. | Use changelog, compatibility docs, rollout notes, rollback plan, and validation evidence. |
| Plugin metadata, marketplace schema, registry | [marketplace](../../../nova-plugin/packs/marketplace) | Use nova repository scripts and schemas for manifest and compatibility validation. | Use schema validators, documented metadata rules, and manual JSON review. |
| Host-project portal or registry UI, deferred portal IA, accessibility, interaction | [frontend](../../../nova-plugin/packs/frontend) | Use the host project's existing frontend stack, preview server, tests, and accessibility tools when present. | Use existing files, manual QA checklists, responsive reasoning, and documentation constraints. |
| MCP config, server/client examples, tool integration | [mcp](../../../nova-plugin/packs/mcp) | Use available MCP tools or plugins for discovery, schema understanding, and integration checks. | Use `.mcp.json`, docs, schema checks, config review, and manual permission reasoning. |

## Routing Patterns

| Request | Core Route | Pack Route |
| --- | --- | --- |
| "Design a Spring Boot endpoint and migration plan." | `architect` | [java](../../../nova-plugin/packs/java) |
| "Implement the approved backend plan." | `builder` | [java](../../../nova-plugin/packs/java) and [dependency](../../../nova-plugin/packs/dependency) if build files change |
| "Review this PR for security and maintainability." | `reviewer` | [security](../../../nova-plugin/packs/security) plus domain packs from touched files |
| "Run local validation and explain failures." | `verifier` | Packs selected by failing commands |
| "Update README, CHANGELOG, and release handoff." | `publisher` | [docs](../../../nova-plugin/packs/docs) and [release](../../../nova-plugin/packs/release) |
| "Verify this framework guidance against official docs." | `reviewer` or `architect` | [docs](../../../nova-plugin/packs/docs) plus the relevant domain pack |
| "Cross-check this high-confidence security-sensitive decision." | `reviewer` | [security](../../../nova-plugin/packs/security) plus relevant domain packs |
| "Plan a deprecation or migration path." | `architect` then `publisher` | [release](../../../nova-plugin/packs/release) and [docs](../../../nova-plugin/packs/docs) |
| "Marketplace schema validation failed." | `verifier` then `builder` | [marketplace](../../../nova-plugin/packs/marketplace) |
| "The host project's registry UI has layout and accessibility issues." | `reviewer` then `builder` | [frontend](../../../nova-plugin/packs/frontend) |
| "Add MCP server setup docs." | `architect` then `publisher` | [mcp](../../../nova-plugin/packs/mcp) and [docs](../../../nova-plugin/packs/docs) |

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

</details>

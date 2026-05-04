# Agent Routing (Core Agents)

Active agents live in `nova-plugin/agents/`. The active set is six core agents plus documentation-only capability packs in `nova-plugin/packs/`.

Legacy agents are archived under `.claude/agents/archive/nova-plugin/agents/` (see [MIGRATION_MANIFEST.md](MIGRATION_MANIFEST.md)). The former active specialist set is mapped to core agents and packs in [CORE_AGENTS_MIGRATION.md](CORE_AGENTS_MIGRATION.md).

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

Capability packs are optional routing context, not runtime-loaded agents. See [PLUGIN_AWARE_ROUTING.md](PLUGIN_AWARE_ROUTING.md) for enhanced and fallback behavior.

| Pack | Use For |
| --- | --- |
| `java` | Java, Spring, Maven, Gradle. |
| `security` | Security review, hardening, static scanning. |
| `dependency` | Dependency upgrades, vulnerabilities, supply-chain risk. |
| `docs` | README, CLAUDE.md, AGENTS.md, technical docs. |
| `release` | CHANGELOG, version strategy, session reports, handoff. |
| `marketplace` | Plugin and marketplace schemas, registry metadata. |
| `frontend` | Portal or registry UI, accessibility, interaction quality. |
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

## How `orchestrator` Delegates

1. Read the user request and detect domain smells.
2. Split into 1-5 subtasks, each with one owning core agent.
3. Attach one or more capability packs when domain rules apply.
4. Ask only for missing inputs that block safe routing.
5. Define deliverables, validation commands, enhanced mode, and fallback mode for the whole work.

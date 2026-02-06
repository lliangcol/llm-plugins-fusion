# Agent Routing (Active Set)

Active agents live in `nova-plugin/agents/`. Legacy agents are archived under `.claude/agents/archive/nova-plugin/agents/` (see `docs/agents/MIGRATION_MANIFEST.md`).

## Active agents

- `orchestrator` — default entry; routes work to the right agent(s), does not implement.
- `java-backend-engineer` — Java/Spring backend implementation.
- `api-design` — API contracts + OpenAPI/docs.
- `refactoring-specialist` — safe refactors, tech-debt reduction.
- `quality-engineer` — QA + debugging + code review (keeps checklist-style output).
- `test-automator` — automated tests and reliability.
- `devops-platform` — CI/CD, deploy, infra/platform, tooling, DX.
- `build-deps` — builds + dependencies + lockfiles.
- `git-release-manager` — branching, versioning, tags, releases, changelog.
- `incident-responder` — incident triage/mitigation/runbooks/postmortems.
- `data-analytics` — metrics/KPIs/funnels/research insights (optional DS).
- `db-engineer` — SQL/schema/perf/Postgres guidance.
- `security-engineer` — practical security engineering + hardening.
- `security-audit` — security/compliance audits + evidence + remediation tracking.

## Keyword routing table

| keyword / smell                                | route to                 | notes                                     |
| ---------------------------------------------- | ------------------------ | ----------------------------------------- |
| “which agent”, “route”, ambiguous owner        | `orchestrator`           | may fan out to 1–3 agents                 |
| java, spring, controller/service, maven/gradle | `java-backend-engineer`  | implementation                            |
| api, openapi, swagger, contract, pagination    | `api-design`             | docs/spec; code changes may go to backend |
| refactor, cleanup, tech debt, modularize       | `refactoring-specialist` | behavior-preserving                       |
| bug, failing tests, review, regression, flaky  | `quality-engineer`       | triage + review + fix plan                |
| tests, coverage, integration tests, CI tests   | `test-automator`         | add/fix tests                             |
| ci/cd, pipeline, deploy, docker/k8s, terraform | `devops-platform`        | platform & delivery                       |
| dependency conflict, lockfile, upgrade         | `build-deps`             | build + deps                              |
| release, tag, version, changelog, hotfix       | `git-release-manager`    | process + commands                        |
| outage, 5xx spike, latency, rollback now       | `incident-responder`     | stop the bleeding                         |
| metrics, kpi, funnel, cohort, retention        | `data-analytics`         | analysis & definitions                    |
| sql, postgres, slow query, index, migration    | `db-engineer`            | DB guidance                               |
| security, secrets, auth, hardening, owasp      | `security-engineer`      | mitigations                               |
| audit, compliance, SOC2/ISO/PCI/GDPR           | `security-audit`         | evidence + gaps                           |

## Common task examples (copy-friendly)

1. “Spring Boot 新增接口并生成 OpenAPI 文档” → `java-backend-engineer` + `api-design`
2. “帮我评审这次 PR：安全/性能/可维护性” → `quality-engineer`
3. “CI 挂了：依赖冲突/lockfile 变更导致构建失败” → `build-deps`
4. “发布流程：版本号、tag、changelog、hotfix 怎么做” → `git-release-manager`
5. “线上 5xx 激增，需要止血/回滚/定位” → `incident-responder`（可能再分派到其它 agent）
6. “SQL 慢查询，给索引建议并解释原因” → `db-engineer`
7. “定义留存/转化漏斗口径并做分析建议” → `data-analytics`
8. “做一次 secrets/auth/config 的安全加固建议” → `security-engineer`
9. “做 SOC2/ISO 审计清单和证据收集表” → `security-audit`
10. “大型重构：模块拆分，降低耦合” → `refactoring-specialist`
11. “补测试：提升覆盖率并修复 flaky” → `test-automator`
12. “部署/环境/容器/CI/CD/平台治理问题” → `devops-platform`

## How `orchestrator` delegates

1. Read the user request; detect smells/keywords.
2. Split into 1–5 subtasks, each with one owning active agent.
3. Ask for missing inputs per subtask (1–3 questions).
4. Define deliverables and verification commands for the whole work.

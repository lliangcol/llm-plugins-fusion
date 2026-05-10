# Roadmap

最后审阅：2026-05-10

本路线图基于当前 `llm-plugins-fusion` 仓库现状制定：仓库定位为公开的
多项目 AI 工程工作流框架，仍以一个主插件 `nova-plugin` 为核心。当前已经具备
生成式 marketplace 安装/分发元数据、6 个 core agents、8 个文档型 capability
packs、consumer profile 模板，以及覆盖 schema、Claude 兼容性、frontmatter、
agents、packs、hooks 和文档的本地/CI 校验体系。

## 当前基线

项目已经走出早期的“让插件能被 Claude CLI 接受并通过校验”阶段。以下能力
应视为新的稳定基线，而不是未来计划：

| 领域 | 当前状态 |
| --- | --- |
| 发布版本 | `nova-plugin` 当前稳定版本为 `2.1.0`；正式 tag `v2.1.0` 与 GitHub release 已于 2026-05-09 创建。 |
| 插件能力面 | 20 个 slash commands 与 20 个一对一 `nova-*` skills。 |
| Agent 模型 | `nova-plugin/agents/` 中固定 6 个 active core agents；旧 specialist agent 模型已进入 legacy。 |
| Capability packs | `nova-plugin/packs/` 中固定 8 个 packs，均声明 enhanced mode 与 fallback mode。 |
| Consumer profiles | `docs/consumers/` 提供公开 profile 契约与脱敏 Java backend / frontend 模板；真实 profile 保存在 consumer 项目本地。 |
| Redacted examples | `docs/examples/` 提供脱敏 Java backend 与 frontend workflow 示例，不包含真实 consumer 信息。 |
| Registry 模型 | `.claude-plugin/registry.source.json` 生成 Claude-compatible marketplace 输出、repository-local metadata 和 Markdown catalog。 |
| 质量门 | `node scripts/validate-all.mjs` 是本地总入口，并包含 registry fixture 校验。 |
| Marketplace 分发 | marketplace 继续作为安装/分发形式；生成 catalog 满足当前浏览和评审，不启动 public portal。 |
| 发布决策 | [vNext release decision](docs/releases/vnext-release-decision.md) 已将 active-agent 变化确认为 `2.0.0` major release 兼容边界。 |

关键结论：旧路线图中“`v2.0.0` = monorepo 重构”的含义不再适用。
当前下一次 major 应留给已经发生的 active-agent 兼容边界变化；多插件目录重构
应后移为未来 major 候选。

## 总方向

当前优先级是 workflow framework + consumer profile templates。项目目标是让
`nova-plugin` 成为可复用的多项目 AI 工程工作流框架，并通过公开仓库沉淀通用
workflow、profile 契约、脱敏模板和通用 pack 指南。Marketplace 继续作为安装
与分发形式保留，但不是当前叙事的成熟多插件生态。

新的推进顺序是：

1. 先稳定并发布当前兼容边界。
2. 再让五阶段 workflow 与 consumer profile 契约足够清晰。
3. 继续补强 Java、frontend、security、dependency 等通用 pack 指南。
4. 保持 registry、trust、兼容性与安全审查元数据可靠，服务安装/分发。
5. 最后基于真实维护压力决定是否进入 breaking 的多插件目录结构与公开 portal。

这条路径避免在 registry、贡献流程和信任模型还不够强时，过早承诺一个需要
长期维护的 marketplace UI，也避免为单个领域提前扩张大量 `/java-*` 或
`/frontend-*` 命令。

## Milestone 1: v2.0.0 active-agent 兼容边界发布

目标时间：2026-05

目标：把当前架构作为明确的 major release 发布；不移动插件路径，
不引入无关交付风险。

| 工作项 | 状态 | 验收标准 |
| --- | --- | --- |
| 确认 major 版本决策 | Accepted | 维护者接受 active-agent 变化属于公开兼容边界变化。 |
| 准备发布元数据 | Completed | `plugin.json`、registry source `last-updated`、生成的 marketplace 文件、README badge 和 changelog 均同步到 `2.0.0`。 |
| 发布迁移说明 | Completed | 用户能清楚看到 commands/skills 兼容，active agents 已收敛为 6-core 模型。 |
| 关闭 Unreleased changelog | Completed | 当前 Unreleased 条目进入 `2.0.0` release section，并明确 `BREAKING` 说明。 |
| 运行全量校验 | Passed | 2026-05-06 已运行 `node scripts/validate-all.mjs`，并通过 Git Bash 补跑本地 hook `bash -n`，结果 `failed=0 skipped=0`。 |
| 创建正式发布 | Released | `v2.0.0` annotated tag 与 GitHub release 已创建，release notes 来自 `CHANGELOG.md` 的 `2.0.0` section。 |

`2.0.0` 非目标：

- 不移动 `nova-plugin/`。
- 不做 frontend portal。
- 不把 signing、SBOM、release-please 或 changesets 设为发布阻断项。
- 不为了“市场”叙事而强行新增第二个插件。

## Milestone 2: v2.1.0 Registry 与作者工作流

目标时间：`2.0.0` 后 4-6 周

目标：让未来插件作者能理解如何新增、验证和维护插件，同时保持当前单插件
目录布局继续有效。

状态：Released / Completed。`v2.1.0` 于 2026-05-09 发布，并合并当前
`Unreleased` 中非破坏性的 registry、作者工作流、trust、兼容性和评审策略
改进。

| 工作项 | 状态 | 验收证据 |
| --- | --- | --- |
| 强化 registry generation | Completed | `fixtures/registry/multi-plugin/` 覆盖两个插件 entry；`scripts/validate-registry-fixtures.mjs` 接入 `validate-all`、CI 与 release precheck；当前单插件 `nova-plugin/` 布局继续由 `validate-schemas` 校验。 |
| 补齐插件作者文档 | Completed | [Registry author workflow](docs/marketplace/registry-author-workflow.md) 与 [CONTRIBUTING.md](CONTRIBUTING.md) 解释新增插件 entry、生成产物、校验和评审流程。 |
| 完成 scaffold 工作流说明 | Completed | [Registry author workflow](docs/marketplace/registry-author-workflow.md) 记录 `scripts/scaffold.mjs` dry-run 示例、`read` / `artifact` / `implementation` profile 和后续校验要求。 |
| 生成 catalog artifact | Completed | `node scripts/generate-registry.mjs --write` 生成 [Marketplace catalog](docs/marketplace/catalog.md)，不新增部署依赖。 |
| 兼容矩阵补强 | Completed | [Compatibility matrix](docs/marketplace/compatibility-matrix.md) 记录 Claude Code、Codex CLI、Bash、Node.js 和 optional enhanced tools 前置条件。 |

建议校验：

```bash
node scripts/generate-registry.mjs
node scripts/validate-schemas.mjs
node scripts/validate-registry-fixtures.mjs
node scripts/validate-claude-compat.mjs
node scripts/lint-frontmatter.mjs
node scripts/validate-docs.mjs
```

## Milestone 3: v2.2.0 Trust、维护状态与评审策略

目标时间：registry 作者工作流稳定之后

目标：让 marketplace entries 对外部贡献而言可评审、可维护、可追踪风险。

状态：Completed in `v2.1.0`。原计划单独作为 `v2.2.0` 发布的非破坏性
trust、维护状态与评审策略工作已合并进 `v2.1.0`；当前没有独立
`v2.2.0` Unreleased 范围。

| 工作项 | 状态 | 验收证据 |
| --- | --- | --- |
| Trust policy | Completed | [Trust policy](docs/marketplace/trust-policy.md) 定义 `trust-level`、`risk-level`、`deprecated`、`last-updated`、`maintainer`、`compatibility` 和 `review` 语义与评审要求。 |
| Contribution checklist | Completed | [`.github/pull_request_template.md`](.github/pull_request_template.md) 要求校验输出、metadata rationale、安全说明和维护 owner；[CONTRIBUTING.md](CONTRIBUTING.md) 链接该流程。 |
| Compatibility evidence | Completed | `.claude-plugin/registry.source.json` 每个 plugin entry 必填 compatibility evidence；生成的 [Marketplace catalog](docs/marketplace/catalog.md) 展示命令/skill 覆盖、校验状态和前置条件。 |
| Security review route | Completed | [Security review route](docs/marketplace/security-review-route.md) 基于 security pack、core reviewer/verifier 职责和现有质量门定义安全敏感插件变更路径。 |
| Release hygiene | Completed | [Release hygiene](docs/releases/release-hygiene.md) 说明 tag/version 同步、生成产物漂移检查、changelog 要求和 Bash skip 说明。 |

该里程碑应保持非破坏性。如果新的 trust 或 metadata 字段会被 Claude CLI 拒绝，
字段必须继续留在 repository-local metadata，不应写回 Claude-compatible
marketplace manifest。

## Milestone 4: v3.0.0 多插件目录与 public portal 候选

目标时间：只有当 `v2.1.0` 发布后的真实使用情况证明多插件维护确实必要时才启动。

目标：决定仓库是否需要显式多插件布局，以及公开 portal 是否值得承担维护成本。

状态：Deferred。`v2.1.0` 已经通过 fixture、生成 catalog、metadata evidence
与评审文档解决当前维护痛点；仓库仍只有一个
主插件、一个 maintainer cadence，且没有多个 plugin owner 或公开 portal 运营压力。
因此没有证据支持现在启动 breaking 的目录迁移。后续是否激活 `v3.0.0`
由 [v3 readiness evidence](docs/marketplace/v3-readiness-evidence.md) 记录真实
维护压力和启动门槛。

当前边界：

- 优先推进 workflow framework + consumer profile templates。
- 暂不做 public portal。
- 暂不做多插件目录迁移。
- 暂不新增大量 `/java-*` 或 `/frontend-*` 领域命令；领域差异优先通过
  capability packs 和 consumer profile 承接。
- `v3.0.0` 继续 deferred，除非出现真实多插件、多 owner、独立发布节奏或当前
  布局维护压力的证据。

| 工作项 | 决策门槛 | 状态 / rationale |
| --- | --- | --- |
| Evidence tracking | Required before activation | Active：使用 [v3 readiness evidence](docs/marketplace/v3-readiness-evidence.md) 记录 post-`v2.1.0` 信号；当前证据仍不足以启动 migration。 |
| 多插件目录布局 | Required | Deferred：当前 `nova-plugin/` 路径仍满足安装和 registry 维护；仅 fixture 覆盖多 entry 生成，不迁移真实目录。 |
| Public portal | Optional | Deferred：生成的 Markdown catalog 已满足当前浏览与评审需求，不引入 frontend stack 或部署依赖。 |
| Plugin split | Optional | Deferred：没有真实用户需求证明需要拆出 `nova-core` 或 Codex-loop packaging。 |
| 领域命令扩张 | Optional | Deferred：Java 和 frontend 差异先由 packs、consumer profile 和脱敏模板承接，不新增大量领域命令。 |
| Release automation | Optional | Deferred：当前 release hygiene、CI 和手工 runbook 足以控制风险；SBOM、签名或 release notes 自动化暂不设为阻断项。 |
| Ecosystem submission | Optional | Deferred：等待 metadata、安装指引和真实多插件维护压力进一步稳定。 |

不应仅为目录美观而做 major 重构。触发条件应是实际维护压力：多个插件 owner、
不同 release cadence，或当前布局已经明显拖累 registry 运维。

## 持续工作流

这些工作通常不需要单独占用版本号，除非它们改变用户可见行为。

| 工作流 | 规则 |
| --- | --- |
| Documentation | 命令数量、skill 数量、agents、packs 或工作流约束变化时，同步 README、命令文档、skill 文档、`AGENTS.md` 和 `CLAUDE.md`。 |
| Consumer profiles | 公开仓库只维护通用契约、脱敏模板和示例；真实 consumer profile 保存在 consumer 项目本地。 |
| Validation | 优先扩展仓库脚本，而不是依赖人工 checklist；registry 行为变化需要同步 fixture 覆盖。 |
| Claude compatibility | Claude 可接受的 plugin 字段与 repository-local marketplace metadata 继续分离。 |
| Registry catalog | `docs/marketplace/catalog.md` 保持由 `node scripts/generate-registry.mjs --write` 生成，不手工漂移。 |
| Roadmap evidence | `docs/marketplace/v3-readiness-evidence.md` 记录是否存在足够真实维护压力来激活 `v3.0.0`，不得用 fixture-only 支持替代生产迁移证据。 |
| Codex loop | `codex-review-only`、`codex-review-fix`、`codex-verify-only` 的 artifact 规则继续保持严格；不得提交 `.codex/` runtime 输出。 |
| Agents and packs | active agents 固定 6 个、packs 固定 8 个，除非未来 release 明确改变该契约。 |
| Internationalization | 触碰用户文档时顺手提高英文覆盖率。 |

## 明确非目标

- 不做付费 marketplace、托管私有 registry 或商业授权层。
- 不构建自定义 coding-assistant 客户端。
- 不做 public portal，除非 v3 readiness evidence 出现足够真实需求。
- 不做多插件目录迁移，除非出现真实多插件、多 owner、独立发布节奏或当前布局维护压力。
- 不新增大量 `/java-*` 或 `/frontend-*` 领域命令；优先使用 capability packs 与 consumer profile。
- 不引入 runtime dynamic pack/plugin loading，除非后续设计单独批准。
- 不为了展示数据而引入新的 frontend stack；现阶段 Markdown 与生成的 registry 文件优先。
- 不做没有兼容窗口和迁移说明的破坏性安装路径变更。

## 路线图维护规则

当版本边界、command/skill 数量、active agents、capability packs、registry
事实源或发布质量门变化时，更新本文件。面向 release 的变更还需要同步：

- [CHANGELOG.md](CHANGELOG.md)
- [README.md](README.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [AGENTS.md](AGENTS.md)
- [CLAUDE.md](CLAUDE.md)
- [docs/releases/vnext-release-decision.md](docs/releases/vnext-release-decision.md)
- [docs/releases/release-hygiene.md](docs/releases/release-hygiene.md)
- [docs/marketplace/portal-information-architecture.md](docs/marketplace/portal-information-architecture.md)
- [docs/marketplace/registry-author-workflow.md](docs/marketplace/registry-author-workflow.md)
- [docs/marketplace/compatibility-matrix.md](docs/marketplace/compatibility-matrix.md)
- [docs/marketplace/trust-policy.md](docs/marketplace/trust-policy.md)
- [docs/marketplace/security-review-route.md](docs/marketplace/security-review-route.md)

纯文档型 roadmap 变更至少运行：

```bash
node scripts/validate-docs.mjs
```

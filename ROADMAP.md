# Roadmap

最后审阅：2026-05-06

本路线图基于当前 `llm-plugins-fusion` 仓库现状制定：仓库仍以一个主插件
`nova-plugin` 为核心，已具备生成式 marketplace 元数据、6 个 core agents、
8 个文档型 capability packs，以及覆盖 schema、Claude 兼容性、frontmatter、
agents、packs、hooks 和文档的本地/CI 校验体系。

## 当前基线

项目已经走出早期的“让插件能被 Claude CLI 接受并通过校验”阶段。以下能力
应视为新的稳定基线，而不是未来计划：

| 领域 | 当前状态 |
| --- | --- |
| 发布版本 | `nova-plugin` 当前 release candidate 版本为 `2.0.0`；正式 tag / GitHub release 尚未创建。 |
| 插件能力面 | 20 个 slash commands 与 20 个一对一 `nova-*` skills。 |
| Agent 模型 | `nova-plugin/agents/` 中固定 6 个 active core agents；旧 specialist agent 模型已进入 legacy。 |
| Capability packs | `nova-plugin/packs/` 中固定 8 个 packs，均声明 enhanced mode 与 fallback mode。 |
| Registry 模型 | `.claude-plugin/registry.source.json` 生成 Claude-compatible marketplace 输出和 repository-local metadata。 |
| 质量门 | `node scripts/validate-all.mjs` 是本地总入口。 |
| Marketplace 门面 | 已有文档型准备：[Marketplace portal IA](docs/marketplace/portal-information-architecture.md)。 |
| 发布决策 | [vNext release decision](docs/releases/vnext-release-decision.md) 已将当前工作确认为 `2.0.0` release candidate 兼容边界。 |

关键结论：旧路线图中“`v2.0.0` = monorepo 重构”的含义不再适用。
当前下一次 major 应留给已经发生的 active-agent 兼容边界变化；多插件目录重构
应后移为未来 major 候选。

## 总方向

项目目标仍是从“维护良好的单插件仓库”演进为“可信的第三方 LLM 编码助手插件
市场”。新的推进顺序是：

1. 先稳定并发布当前兼容边界。
2. 再让 registry 与插件作者工作流足够实用。
3. 继续补强 trust、维护状态、兼容性与安全审查元数据。
4. 最后基于真实维护压力决定是否进入 breaking 的多插件目录结构与公开 portal。

这条路径避免在 registry、贡献流程和信任模型还不够强时，过早承诺一个需要
长期维护的 marketplace UI。

## Milestone 1: v2.0.0 active-agent 兼容边界发布

目标时间：2026-05

目标：把当前 unreleased 架构作为明确的 major release 发布；不移动插件路径，
不引入无关交付风险。

| 工作项 | 状态 | 验收标准 |
| --- | --- | --- |
| 确认 major 版本决策 | Accepted | 维护者接受 active-agent 变化属于公开兼容边界变化。 |
| 准备发布元数据 | Prepared | `plugin.json`、registry source `last-updated`、生成的 marketplace 文件、README badge 和 changelog 均同步到 `2.0.0`。 |
| 发布迁移说明 | Prepared | 用户能清楚看到 commands/skills 兼容，active agents 已收敛为 6-core 模型。 |
| 关闭 Unreleased changelog | Prepared | 当前 Unreleased 条目进入 `2.0.0` release section，并明确 `BREAKING` 说明。 |
| 运行全量校验 | Pending | `node scripts/validate-all.mjs` 通过；本地 Bash hook 语法检查是否实际运行需如实记录。 |

`2.0.0` 非目标：

- 不移动 `nova-plugin/`。
- 不做 frontend portal。
- 不把 signing、SBOM、release-please 或 changesets 设为发布阻断项。
- 不为了“市场”叙事而强行新增第二个插件。

## Milestone 2: v2.1.0 Registry 与作者工作流

目标时间：`2.0.0` 后 4-6 周

目标：让未来插件作者能理解如何新增、验证和维护插件，同时保持当前单插件
目录布局继续有效。

| 工作项 | 优先级 | 验收标准 |
| --- | --- | --- |
| 强化 registry generation | High | 增加多插件 entry fixture 覆盖，同时保持当前单插件布局有效。 |
| 补齐插件作者文档 | High | `CONTRIBUTING.md` 和 marketplace docs 解释新增插件 entry、校验和评审流程。 |
| 完成 scaffold 工作流说明 | High | `scripts/scaffold.mjs` 有 dry-run 示例、常见 profile 说明和后续校验要求。 |
| 生成 catalog artifact | Medium | 可选 Markdown catalog 能由 registry 输出生成，不新增部署依赖。 |
| 兼容矩阵补强 | Medium | Claude Code、Codex CLI、Bash 和 optional enhanced tools 的前置条件由仓库事实表达。 |

建议校验：

```bash
node scripts/generate-registry.mjs
node scripts/validate-schemas.mjs
node scripts/validate-claude-compat.mjs
node scripts/lint-frontmatter.mjs
node scripts/validate-docs.mjs
```

## Milestone 3: v2.2.0 Trust、维护状态与评审策略

目标时间：registry 作者工作流稳定之后

目标：让 marketplace entries 对外部贡献而言可评审、可维护、可追踪风险。

| 工作项 | 优先级 | 验收标准 |
| --- | --- | --- |
| Trust policy | High | `trust-level`、`risk-level`、`deprecated`、`last-updated` 的语义和评审要求有明确文档。 |
| Contribution checklist | High | PR 模板或文档要求提交校验输出、metadata rationale、安全说明和维护 owner。 |
| Compatibility evidence | Medium | 每个 plugin entry 能指向命令/skill 覆盖、校验状态和已知运行前置条件。 |
| Security review route | Medium | 安全敏感插件变更有基于 security pack 与现有质量门的评审路径。 |
| Release hygiene | Medium | release 文档说明 tag/version 同步、生成产物漂移检查和 changelog 要求。 |

该里程碑应保持非破坏性。如果新的 trust 或 metadata 字段会被 Claude CLI 拒绝，
字段必须继续留在 repository-local metadata，不应写回 Claude-compatible
marketplace manifest。

## Milestone 4: v3.0.0 多插件 marketplace 候选

目标时间：只有当 `v2.1.0` 与 `v2.2.0` 证明多插件维护确实必要时才启动。

目标：决定仓库是否需要显式多插件布局，以及公开 portal 是否值得承担维护成本。

| 工作项 | 决策门槛 | 验收标准 |
| --- | --- | --- |
| 多插件目录布局 | Required | 迁移计划解释 `nova-plugin/` 兼容策略、新 `plugins/*` 路径和 deprecation window。 |
| Public portal | Optional | Portal 消费生成的 registry 数据，不成为新的 metadata 事实源。 |
| Plugin split | Optional | 任何拆分，例如 `nova-core` 或 Codex-loop packaging，都有用户需求和迁移文档。 |
| Release automation | Optional | SBOM、签名和 release notes 自动化只在能降低实际发布风险时引入。 |
| Ecosystem submission | Optional | 官方或第三方 marketplace 提交等待 metadata 与安装指引稳定后再做。 |

不应仅为目录美观而做 major 重构。触发条件应是实际维护压力：多个插件 owner、
不同 release cadence，或当前布局已经明显拖累 registry 运维。

## 持续工作流

这些工作通常不需要单独占用版本号，除非它们改变用户可见行为。

| 工作流 | 规则 |
| --- | --- |
| Documentation | 命令数量、skill 数量、agents、packs 或工作流约束变化时，同步 README、命令文档、skill 文档、`AGENTS.md` 和 `CLAUDE.md`。 |
| Validation | 优先扩展仓库脚本，而不是依赖人工 checklist。 |
| Claude compatibility | Claude 可接受的 plugin 字段与 repository-local marketplace metadata 继续分离。 |
| Codex loop | `codex-review-only`、`codex-review-fix`、`codex-verify-only` 的 artifact 规则继续保持严格；不得提交 `.codex/` runtime 输出。 |
| Agents and packs | active agents 固定 6 个、packs 固定 8 个，除非未来 release 明确改变该契约。 |
| Internationalization | 触碰用户文档时顺手提高英文覆盖率。 |

## 明确非目标

- 不做付费 marketplace、托管私有 registry 或商业授权层。
- 不构建自定义 coding-assistant 客户端。
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
- [docs/marketplace/portal-information-architecture.md](docs/marketplace/portal-information-architecture.md)

纯文档型 roadmap 变更至少运行：

```bash
node scripts/validate-docs.mjs
```

# nova-plugin 文档索引

此目录保存 `nova-plugin` 的用户文档、命令文档、架构说明和历史记录。`nova-plugin` 是公开多项目 AI 工程工作流框架的主插件交付物；marketplace 是安装与分发形式，不表示当前已经是成熟的多插件生态。当前文档覆盖由 `node scripts/validate-docs.mjs` 校验：Markdown 本地链接与锚点、命令文档 stage 位置、版本日期同步、`/review LEVEL=lite` 契约，以及命令文档三件套完整性。

## 快速入口

| 分类 | 路径 | 内容 |
| --- | --- | --- |
| 使用手册 | [guides/](guides/) | 命令参考、命令选择、复制模板 |
| 命令文档 | [commands/](commands/) | 20 个命令的详细说明与中英文 README |
| 架构与设计 | [architecture/](architecture/) | 当前 command / skill 双轨设计、hooks 设计 |
| Agents | [agents/](agents/) | core agent 快速索引与 legacy archive 汇总 |
| Capability packs | [../packs/README.md](../packs/README.md) | 8 个领域能力包与 enhanced / fallback mode |
| Consumer profiles | [../../docs/consumers/README.md](../../docs/consumers/README.md) | 多项目 consumer profile 契约与脱敏模板 |
| Redacted examples | [../../docs/examples/README.md](../../docs/examples/README.md) | Java backend / frontend 脱敏 workflow 示例 |
| 历史记录 | [history/](history/) | 已归档的历史优化记录，不作为当前状态事实源 |
| English overview | [overview/README.en.md](overview/README.en.md) | English project overview |

## 文档结构

```text
nova-plugin/docs/
|-- README.md
|-- guides/
|   |-- commands-reference-guide.md
|   |-- commands-reference-guide.en.md
|   |-- claude-code-commands-handbook.md
|   `-- claude-code-commands-handbook.en.md
|-- commands/
|   |-- explore/
|   |-- plan/
|   |-- review/
|   |-- implement/
|   |-- finalize/
|   `-- codex/
|-- agents/
|   |-- agents-summary.md
|   `-- agents-summary.en.md
|-- architecture/
|   |-- dual-track-design.md
|   `-- hooks-design.md
|-- history/
|   `-- command-optimization-2026-02-04.md
`-- overview/
    `-- README.en.md
```

## 覆盖范围

| 区域 | 文件数 | 说明 |
| --- | ---: | --- |
| 根索引 | 1 | 当前文件 |
| Guides | 4 | 中英文命令参考与使用手册 |
| Commands | 60 | 20 个命令，每个命令 `<id>.md`、`<id>.README.md`、`<id>.README.en.md` |
| Agents | 2 | 中英文 core agent 快速索引 + legacy archive 汇总 |
| Capability packs | 9 | `nova-plugin/packs/README.md` + 8 个 pack README |
| Architecture | 2 | 当前设计文档 |
| History | 1 | 历史优化记录 |
| Overview | 1 | 英文项目概览 |

## Capability Packs

Core agents use documentation-only capability packs for domain routing. Packs do not add runtime dynamic loading; each pack documents enhanced mode for optional tools and fallback mode for plain repository-based work.

| Pack | 路径 |
| --- | --- |
| `java` | [../packs/java/](../packs/java/) |
| `security` | [../packs/security/](../packs/security/) |
| `dependency` | [../packs/dependency/](../packs/dependency/) |
| `docs` | [../packs/docs/](../packs/docs/) |
| `release` | [../packs/release/](../packs/release/) |
| `marketplace` | [../packs/marketplace/](../packs/marketplace/) |
| `frontend` | [../packs/frontend/](../packs/frontend/) |
| `mcp` | [../packs/mcp/](../packs/mcp/) |

## 命令文档

推荐默认入口是 `/explore`、`/produce-plan`、`/review`、`/implement-plan`、`/finalize-work`。其它命令继续作为高级/兼容入口保留，本文档索引不改变任何命令行为。

常规命令文档按 workflow stage 组织在 `commands/<stage>/` 下。Codex 命令跨 Review / Implement / Finalize 语义，为避免拆散闭环说明，统一维护在 `commands/codex/`；这是明确例外。

| 阶段 | 路径 | 命令 |
| --- | --- | --- |
| Explore | [commands/explore/](commands/explore/) | `explore`, `explore-lite`, `explore-review`, `senior-explore` |
| Plan | [commands/plan/](commands/plan/) | `plan-lite`, `plan-review`, `produce-plan`, `backend-plan` |
| Review | [commands/review/](commands/review/) | `review`, `review-lite`, `review-only`, `review-strict` |
| Implement | [commands/implement/](commands/implement/) | `implement-lite`, `implement-plan`, `implement-standard` |
| Finalize | [commands/finalize/](commands/finalize/) | `finalize-lite`, `finalize-work` |
| Codex | [commands/codex/](commands/codex/) | `codex-review-fix`, `codex-review-only`, `codex-verify-only` |

每个命令必须同时具备：

```text
<id>.md
<id>.README.md
<id>.README.en.md
```

## 常用文档

- [命令完全参考手册](guides/commands-reference-guide.md)
- [命令使用手册](guides/claude-code-commands-handbook.md)
- [Consumer profile templates](../../docs/consumers/README.md)
- [Redacted examples](../../docs/examples/README.md)
- [Codex 闭环说明](commands/codex/codex-review-fix.README.md)
- [Skill-first 设计说明](architecture/dual-track-design.md)
- [Hooks 设计文档](architecture/hooks-design.md)
- [Agents 汇总](agents/agents-summary.md)
- [Capability packs](../packs/README.md)
- [Plugin-aware routing](../../docs/agents/PLUGIN_AWARE_ROUTING.md)
- [Marketplace catalog](../../docs/marketplace/catalog.md)
- [Registry author workflow](../../docs/marketplace/registry-author-workflow.md)
- [v3 readiness evidence](../../docs/marketplace/v3-readiness-evidence.md)
- [Compatibility matrix](../../docs/marketplace/compatibility-matrix.md)
- [Trust policy](../../docs/marketplace/trust-policy.md)
- [Security review route](../../docs/marketplace/security-review-route.md)
- [Release hygiene](../../docs/releases/release-hygiene.md)
- [English overview](overview/README.en.md)

## 维护规则

- 新增、删除、重命名命令时，同步 `nova-plugin/commands/`、`nova-plugin/skills/nova-*/` 和 `nova-plugin/docs/commands/`。
- 用户可见行为、参数、输出、工具权限或安全边界变化时，同步 guides、命令文档和 `CHANGELOG.md`。
- Capability pack 或 plugin-aware routing 改动后运行 `node scripts/validate-packs.mjs`。
- 当前设计文档放在 `architecture/`；阶段性总结、历史优化记录和非当前状态报告放在 `history/` 或仓库级 `docs/reports/archive/`。
- 文档改动后运行：

```bash
node scripts/validate-docs.mjs
```

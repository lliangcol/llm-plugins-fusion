# nova-plugin 文档索引

此目录保存 `nova-plugin` 的用户文档、命令文档和当前架构说明。`nova-plugin` 是公开多项目 AI 工程工作流框架的主插件交付物；marketplace 是安装与分发形式，不表示当前已经是成熟的多插件生态。当前文档覆盖由 `node scripts/validate-docs.mjs` 校验：Markdown 本地链接与锚点、命令文档 stage 位置、版本日期同步、`/review LEVEL=lite` 契约，以及命令文档三件套完整性。

## 快速入口

| 分类 | 路径 | 内容 |
| --- | --- | --- |
| 使用手册 | [guides/](guides/) | 命令参考、命令选择、复制模板 |
| 命令文档 | [commands/](commands/) | 21 个命令的详细说明与中英文 README |
| 架构与设计 | [architecture/](architecture/) | 五层架构、command / skill 双轨设计、hooks 设计 |
| 仓库文档总索引 | [../../docs/README.md](../../docs/README.md) | `docs/` 目录结构、文档清单和维护规则 |
| Agent routing | [../../docs/agents/ROUTING.md](../../docs/agents/ROUTING.md) | 当前 6 个 core agents 与 capability packs 路由 |
| Capability packs | [../packs/README.md](../packs/README.md) | 8 个领域能力包与 enhanced / fallback mode |
| Consumer profiles | [../../docs/consumers/README.md](../../docs/consumers/README.md) | 多项目 consumer profile 契约与脱敏模板 |
| Cross-tool setup | [../../docs/consumers/README.md](../../docs/consumers/README.md) | Cursor、Gemini CLI、OpenCode、Copilot、Codex 等工具消费 nova skills 的入口 |
| Context-safe workflows | [../../docs/workflows/context-safe-agent-workflows.md](../../docs/workflows/context-safe-agent-workflows.md) | 大任务拆分、checkpoint、review/fix/verify 交付闭环 |
| Thin harness, fat skills | [../../docs/workflows/thin-harness-fat-skills.md](../../docs/workflows/thin-harness-fat-skills.md) | 脚本、skill、prompt、pack 和 consumer profile 的沉淀边界 |
| Prompt templates | [../../docs/prompts/README.md](../../docs/prompts/README.md) | Codex、Claude Code 和通用交付文档 prompt 模板 |
| Redacted examples | [../../docs/examples/README.md](../../docs/examples/README.md) | Java backend / frontend 脱敏 workflow 示例 |
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
|-- architecture/
|   |-- agent-development-stack.md
|   |-- dual-track-design.md
|   `-- hooks-design.md
`-- overview/
    `-- README.en.md
```

## 覆盖范围

| 区域 | 文件数 | 说明 |
| --- | ---: | --- |
| 根索引 | 1 | 当前文件 |
| Guides | 4 | 中英文命令参考与使用手册 |
| Commands | 63 | 21 个命令，每个命令 `<id>.md`、`<id>.README.md`、`<id>.README.en.md` |
| Capability packs | 9 | `nova-plugin/packs/README.md` + 8 个 pack README |
| Architecture | 3 | 当前设计文档 |
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

推荐默认入口是 `/explore`、`/produce-plan`、`/review`、`/implement-plan`、`/finalize-work`。当下一步入口不清楚时，先用只读 `/route`。其它命令继续作为高级/兼容入口保留，本文档索引不改变任何命令行为。

常规命令文档按 workflow stage 组织在 `commands/<stage>/` 下。Codex 命令跨 Review / Implement / Finalize 语义，为避免拆散闭环说明，统一维护在 `commands/codex/`；这是明确例外。

| 阶段 | 路径 | 命令 |
| --- | --- | --- |
| Explore | [commands/explore/](commands/explore/) | `route`, `explore`, `explore-lite`, `explore-review`, `senior-explore` |
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
- [Command Reference Guide (English)](guides/commands-reference-guide.en.md)
- [命令使用手册](guides/claude-code-commands-handbook.md)
- [Command Handbook (English)](guides/claude-code-commands-handbook.en.md)
- [仓库文档总索引](../../docs/README.md)
- [Consumer profile templates](../../docs/consumers/README.md)
- [Cursor setup for nova skills](../../docs/consumers/cursor-setup.md)
- [Gemini CLI setup for nova skills](../../docs/consumers/gemini-cli-setup.md)
- [OpenCode setup for nova skills](../../docs/consumers/opencode-setup.md)
- [Copilot setup for nova skills](../../docs/consumers/copilot-setup.md)
- [Codex setup for nova skills](../../docs/consumers/codex-setup.md)
- [Workbench consumer template](../../docs/consumers/workbench-template.md)
- [Context-safe workflows](../../docs/workflows/context-safe-agent-workflows.md)
- [Thin harness, fat skills workflow doctrine](../../docs/workflows/thin-harness-fat-skills.md)
- [Prompt template library](../../docs/prompts/README.md)
- [Redacted examples](../../docs/examples/README.md)
- [Codex 闭环说明](commands/codex/codex-review-fix.README.md)
- [Agent Development Stack](architecture/agent-development-stack.md)
- [Skill-first 设计说明](architecture/dual-track-design.md)
- [Hooks 设计文档](architecture/hooks-design.md)
- [Capability packs](../packs/README.md)
- [Core agent routing](../../docs/agents/ROUTING.md)
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
- 当前设计文档放在 `architecture/`；临时分析、历史优化记录和非当前状态报告不要放入当前交付文档树。
- 文档改动后运行：

```bash
node scripts/validate-docs.mjs
```

# Roadmap

本文件描述 **llm-plugins-fusion / nova-plugin** 的阶段性演进计划。内容可能随生态与官方市场动向调整。

## 定位

**从"单插件发布站"演进为"可被第三方贡献的 LLM 插件市场"**。

三类核心使用者：

- 👤 **插件用户**：Claude Code 的终端用户，关心命令/skill 的开箱即用。
- 🧑‍💻 **插件作者**：希望把自己的命令与工作流打包分发。
- 🛠 **市场维护者**：负责 schema、CI、信任分级与披露。

## 短期（1–2 周）— 标准对齐 + 止血

目标：**发一个干净的 v1.0.8 → v1.1.0，能过未来官方 marketplace schema 校验**。

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| 提交 Codex 三件套并 bump v1.0.8 | ✅ 完成 | `codex-review-fix` / `codex-review-only` / `codex-verify-only` |
| 开放 `schemas/*.json` 封闭性 | ✅ 完成 | Draft-07 继续使用，`additionalProperties: true`；`source` 改 `oneOf` |
| SKILL.md frontmatter 迁移到 Agent Skills 开放标准 | ✅ 完成 | 自定义字段收入 `metadata.novaPlugin.*` |
| 命令 frontmatter 统一 | ✅ 完成 | 补 `allowed-tools`、`invokes.skill`、`destructive-actions` 枚举 |
| 社区标准文档（本 PR） | 🚧 进行中 | `CONTRIBUTING.md` / `SECURITY.md` / `CODE_OF_CONDUCT.md` / `ROADMAP.md` |
| `lint-frontmatter.mjs` + CI 接入 | ⏳ 计划 | 防止命令/skill 元数据漂移 |
| `check-manifest-drift.mjs` | ⏳ 计划 | 校验 `manifest-data.json` 与 `commands/*.md` 一致 |

## 中期（1–2 月）— 多插件 + 市场门面

目标：**把"市场"口号落地为可公开访问的 URL**。

- **仓库结构重构**：`nova-plugin/` → `plugins/nova-core/`；拆出 `plugins/nova-codex-loop/`、`plugins/nova-java-stack/`。`nova-plugin-command-generator/` → `portal/`。
- **marketplace 多条目**：每个 `plugins/*/plugin.json` 自动合成 `marketplace.json`，由 `scripts/generate-registry.mjs` 消除手工双写。
- **portal 升级**：从本地 `manifest.ts` 改为运行时 fetch `marketplace.json`；新增 Marketplace / Discover Tab；前端全文搜索。
- **portal 部署**：`deploy-portal.yml` push-to-main 发布到 GH Pages。
- **脚手架**：`npx create-nova-plugin` / `scripts/scaffold.mjs command /foo` / `scripts/scaffold.mjs skill nova-foo`。
- **示例与演示**：每个命令补 `## Example` / `## Expected Output`；README 首屏录制 asciinema（senior-explore / backend-plan / codex-review-fix）。
- **发布流水线**：release 附 SBOM（syft）+ cosign 签名；CHANGELOG 通过 changesets / release-please 生成。
- **兼容矩阵**：`compatibility: { claude-code: ">=1.0.0", codex: ">=0.5.0" }`。

**迁移策略**：旧路径保留 3–6 个月软链；破坏性变更写 `docs/migration/vX-to-vY.md`；CHANGELOG 使用 `BREAKING:` / `MIGRATION:` 区块。

## 长期（季度级）— 生态 + 可信 + CLI

目标：**具备外部贡献者持续提交、信任分级可追踪、至少 1 个插件被上游收录**。

- **CLI 包管理器**（可选）：`nova install <plugin>` / `nova list` / `nova update`，参考 `ccpi`。
- **`.well-known/claude-plugin-registry.json`**：让第三方聚合站自动爬取，对齐 MCP Server Card 思路。
- **MCP 集成**：至少 1 个插件出 `.mcp.json` 示例。
- **评分 / 推荐**：portal 基于 anonymous usage + GitHub stars + freshness 打分。
- **企业特性**：SSO、private sub-registry 模板、可审计的 trust-level 变更日志。
- **开放标准回馈**：把 `metadata.novaPlugin.*` 扩展提案投回 agentskills 社区讨论。
- **官方市场提交**：把 `nova-core` 提交到 `anthropics/claude-plugins-official`。
- **国际化**：文档英文覆盖从 70% → 100%；portal 中英切换。

## 里程碑跟踪

| 版本 | 预计时间 | 核心能力 |
| --- | --- | --- |
| v1.0.8 | 2026-04 | Codex 闭环三件套 + 开放 schema + SKILL 标准对齐 |
| v1.1.0 | 2026-05 | Frontmatter lint / manifest drift 检查 / 社区文档齐备 |
| v1.2.0 | 2026-06 | portal 公开部署 + 脚手架 + 示例录屏 |
| v2.0.0 | 2026-Q3 | 仓库结构重构为 monorepo；多插件上线；BREAKING 迁移指南 |

## 非目标（明确不做）

- 不做付费功能 / 商业变现。
- 不维护私有闭源分发渠道。
- 不构建与 Claude Code 等同的客户端——我们只是其上的 marketplace。
- 近期不主推自研 CLI；优先适配官方演进方向。

## 反馈

对路线图的建议欢迎开 issue，标签 `roadmap`。重大调整会在 CHANGELOG 的顶部 `Roadmap:` 段落同步。

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

---

## [Unreleased]

### Added
- 新增 `v3.0.0` readiness evidence 台账，用于记录多插件目录和 public portal
  启动门槛，并明确当前仍不启动 breaking 迁移。
- 扩展 `scripts/validate-docs.mjs`，自动校验 `SECURITY.md` 当前 MINOR
  支持范围，并拦截活跃文档中陈旧的 `v1.x` 未来规划标签。

### Fixed
- 修正 `SECURITY.md` 支持范围中的当前 MINOR 版本说明，使其与 `2.1.0`
  发布状态保持一致。
- 修正 hooks 设计文档中过期的 `v1.1` / `v1.2` 未来计划标签，避免与当前
  发布基线混淆。

## [2.1.0] - 2026-05-09

### Added
- 新增 registry 多插件 fixture 校验：`fixtures/registry/multi-plugin/` 与 `scripts/validate-registry-fixtures.mjs`，并接入 `validate-all`、CI 和 release precheck。
- 新增由 registry 生成的 Markdown catalog：`docs/marketplace/catalog.md`。
- 新增 marketplace 作者工作流、兼容矩阵、trust policy、安全评审路径和 release hygiene 文档。
- 新增 PR 模板，要求校验输出、metadata rationale、安全说明和维护 owner。

### Changed
- 更新路线图、v2.0.0 发布记录、portal IA 与安全支持范围文档，使其反映 `v2.0.0` 已正式发布而非候选发布状态。
- 扩展 repository-local marketplace metadata，增加 maintainer、compatibility evidence 和 review policy 链接，同时继续保持 Claude-compatible marketplace manifest 不含自定义 trust/risk 字段。
- 补强 `scripts/scaffold.mjs --help`，直接展示 dry-run 示例、常见 profile 和后续校验入口。
- 将 `nova-plugin` repository-local `risk-level` 调整为 `medium`，与 write-capable commands、hooks 和 Bash script 风险策略保持一致。
- 扩展 registry fixture 校验，扫描完整 marketplace 输出并覆盖 top-level metadata 泄漏场景。
- 扩展 Claude compatibility 静态校验，禁止真实 marketplace manifest 泄漏 `maintainer`、`compatibility` 和 `review` 字段。
- 将 `ROADMAP.md` 中 `v2.1.0` 与 `v2.2.0` 本地可完成项标记为完成，并记录 `v3.0.0` 多插件目录和 public portal 的 deferred rationale。

## [2.0.0] - 2026-05-06

### BREAKING
- Active-agent surface 改为固定 6-core model：`orchestrator`、`architect`、`builder`、`reviewer`、`verifier`、`publisher`。旧 active specialist agent 文件不再作为公开 active set 提供；需要通过 core agents 与 capability packs 的迁移映射承接旧角色。

### Compatibility
- Commands 兼容：20 个 Claude Code command 文件继续保留，`/review-lite`、`/review-only`、`/review-strict` 等兼容入口仍可使用。
- Skills 兼容：20 个 `nova-*` skills 继续与 commands 保持一对一映射，并继续使用 Agent Skills frontmatter 契约。

### Added
- 新增 `nova-plugin/packs/` capability packs：`java`、`security`、`dependency`、`docs`、`release`、`marketplace`、`frontend`、`mcp`，所有 pack 均声明 enhanced mode 与 fallback mode。
- 新增 `scripts/validate-packs.mjs`，校验 pack 目录、README 标准章节、pack 索引与 plugin-aware routing 引用。
- 新增 `docs/agents/PLUGIN_AWARE_ROUTING.md` 与 `docs/agents/CORE_AGENTS_MIGRATION.md`，记录 core agent + pack 路由规则和旧 active specialist set 的替代映射。
- 新增 `scripts/validate-all.mjs` 作为本地仓库校验总入口，并在 Windows 无 Bash 时明确 warning 跳过本地 `bash -n`。
- 新增 `scripts/validate-docs.mjs`，校验 Markdown 本地链接与锚点、命令文档 stage 覆盖、版本日期同步和报告归档状态。
- 新增 `.claude-plugin/marketplace.metadata.json` 与对应 schema，用于保存 marketplace 自定义 trust/risk/deprecation/date 元数据。
- 新增 `scripts/validate-claude-compat.mjs`，静态拦截 Claude CLI 拒绝的 marketplace 插件级字段，并在 Claude CLI 可用时运行插件兼容校验。
- 新增 `.claude-plugin/registry.source.json`、`schemas/registry-source.schema.json` 与 `scripts/generate-registry.mjs`，为 marketplace 与 repository-local metadata 提供自动生成输入契约。
- 新增 marketplace portal 信息架构准备文档，明确市场门面数据源、导航模型和 vNext / v2.0.0 / v2.1.0 / v2.2.0 / v3.0.0 边界。
- 新增 `v2.0.0` 人工发布步骤文档，覆盖最终校验、提交、打 tag、GitHub Release 监控、安装 smoke check 和失败处理。

### Changed
- 将 active agents 从 14 个固定专家收敛为 6 个 core agents：`orchestrator`、`architect`、`builder`、`reviewer`、`verifier`、`publisher`。
- `scripts/verify-agents.sh` 与 `scripts/verify-agents.ps1` 改为校验 6 个 core agent 文件、frontmatter 必需字段、`name` 与 basename 一致性，以及 agent 正文标准标签。
- `scripts/validate-all.mjs` 接入 pack validation。
- 发布版本确认为 `2.0.0`，将 active-agent 兼容边界变化作为 major release 处理。
- 全面优化根 `README.md` 与英文概览，补强安装、命令选择、文档导航、维护规则和质量门说明。
- 重写 `ROADMAP.md`，将当前 unreleased 架构规划为 `2.0.0` 兼容边界发布，并将 registry 作者工作流、trust 策略和多插件 marketplace 重构拆分到后续里程碑。
- 重整 `nova-plugin/docs/` 索引，将历史命令优化总结移入 `nova-plugin/docs/history/`，避免与当前架构文档混淆。
- 明确 `agents-summary` 的 active agent 快速索引与 legacy archive 摘要边界，降低误读为当前 active 集合的风险。
- CI 与 release 预检接入 docs 校验；Codex 项目检查脚本补充 hooks、docs 和 hook `bash -n` 校验任务。
- 将 2026-04-28 项目状态审计报告移入 `docs/reports/archive/`，并在维护文档中明确历史报告状态。
- 将 `trust-level`、`risk-level`、`deprecated`、`last-updated` 从官方 marketplace manifest 拆分到 repository-local metadata，保持 `claude plugin validate .` 兼容。
- `.claude-plugin/marketplace.json` 与 `.claude-plugin/marketplace.metadata.json` 改为由 registry source 和 `plugin.json` 生成，并由 `validate-schemas` 检测手工漂移。
- `/review` 统一入口现在明确支持 `LEVEL=lite|standard|strict`，并将 `lite` 路由到 `nova-review-lite`。
- CI、release 与 `validate-all` 接入 Claude 兼容校验，并增加 `/review LEVEL=lite` 文档契约防回归检查。
- 清理历史优化总结与 archive notice 中会误导 active agent 位置或历史文件路径的说明。
- 记录 `2.0.0` 正式发布前的本地全量校验结果，明确 hook Bash 语法检查已实际执行且无 skipped 项。

### Removed
- 删除已移除的辅助前端应用，并移除对应的 CI npm lint/test、同步检查脚本与 release 构建产物上传。

### Fixed
- 修复 docs 锚点校验中同一标题 slug 候选重复计数的问题，避免不存在的重复标题锚点被误判为有效。
- 收紧 schema 校验：`format: date` 现在校验真实日历日期，并检测 registry / marketplace / metadata 插件条目的重复 source 或 name。
- release workflow 现在校验 tag 版本必须匹配 `nova-plugin/.claude-plugin/plugin.json` 中的插件版本，避免错误 tag 生成不一致 release。
- 修复 Codex 闭环本地检查未覆盖 Claude 兼容性与 capability pack 校验的问题，避免 `/codex-review-fix` 的本地验证范围弱于仓库质量门。
- 新一轮 Codex review 成功后同步清理旧 `verify.md` 与 `checks.txt`，防止 verify 自动读取上一轮检查产物。
- 修正路线图与贡献清单中 schema 扩展边界、Claude 兼容性校验和 `validate-all` 覆盖范围的过期描述。

## [1.0.9] - 2026-05-04

### Added
- 新增 `nova-plugin/skills/_shared/` 通用策略文档，统一参数解析、安全 preflight、输出契约、artifact 写入规则与 agent routing 边界。
- `scripts/lint-frontmatter.mjs` 增加 command description、command/skill 一对一映射、skill 标准章节、安全 preflight 引用、`allowed-tools` 与 destructive action 一致性校验。

### Changed
- 移除 `nova-plugin/.claude-plugin/plugin.json` 中当前 Claude CLI 不接受或仅属于 marketplace 的字段，并保留 marketplace entry 中的展示元数据。
- 20 个 command 补齐 Claude command `description`，并收敛为 thin slash wrapper；详细行为规则迁移到对应 `SKILL.md`。
- 20 个 skill 增加标准 `Inputs`、`Parameter Resolution`、`Safety Preflight`、输出与失败模式章节，并保留原 command 行为契约作为 skill 事实源。
- 同步 `nova-plugin` 与 marketplace 版本至 1.0.9。

## [1.0.8] - 2026-04-21

### Added
- 补齐 `nova-codex-review-only` 与 `nova-codex-verify-only` 两个 skill 的 `README.md`，完成 Codex 三件套的对外用户文档
- Codex 双复核闭环（review / fix / verify）形成完整用户可见能力集合
- 社区标准文档：`CONTRIBUTING.md` / `SECURITY.md` / `CODE_OF_CONDUCT.md` / `ROADMAP.md`
- `scripts/lint-frontmatter.mjs`：校验命令与 skill 的 frontmatter 契约
- CI 新增 `lint-frontmatter` job

### Changed
- 同步 `nova-plugin` 与 `marketplace.json` 插件版本至 1.0.8
- 迁移 20 个 `SKILL.md` frontmatter 到 Agent Skills 开放标准（自定义字段收入 `metadata.novaPlugin.*`，`allowed-tools` 改空格分隔字符串，补 `license: MIT`）
- 统一 20 个 `commands/*.md` frontmatter：补 `allowed-tools`、新增 `invokes.skill` 指针、`destructive-actions` 由布尔改枚举（`none|low|medium|high`）
- 开放 `schemas/marketplace.schema.json` 与 `schemas/plugin.schema.json`：`additionalProperties: true`，`source` 改 `oneOf`，新增 `category` / `tags` / `keywords` / `license` / `compatibility` / `trust-level` / `risk-level` / `last-updated` 等字段
- 根 `README.md` 新增三栏入口（用户 / 插件作者 / 维护者）

---

## [1.0.7] - 2026-03-26

### Added
- 新增 `nova-codex-review-fix` 技能包，提供 Codex review -> Claude Code fix -> local checks -> Codex verify 半自动闭环
- 新增 `codex-review-fix`、`codex-review-only`、`codex-verify-only` 三个命令及对应 skills / docs
- 新增外部 Bash 脚本与 prompt 模板，用于 review、verify 和统一项目校验

### Changed
- 更新根 README、skills 索引、命令文档导航与版本号

---

## [1.0.6] - 2026-02-12

### Added
- 新增 nova-plugin Skills 目录，17 个命令均配套对应的 SKILL.md 技能文件
- Skills 支持 Claude Code 自动发现与调用（`nova-*` 命名空间）

---

## [1.0.5] - 2026-02-06

### Changed
- 格式化多处文档，统一代码块和章节排版
- 修改网站链接和徽章引用地址

### Added
- 更新 17 个命令文件内容，补充使用示例和约束说明

---

## [1.0.4] - 2026-02-03

### Changed
- 优化 14 个专项 Agent 的描述和路由规则
- 调整 orchestrator agent 的任务分发逻辑

---

## [1.0.3] - 2026-01-22

### Added
- 新增多篇使用文档（中英双语）
- 补充 Agent 概览说明与使用场景示例

### Changed
- 修正 README 标题格式
- 更新版本号至 1.0.3

---

## [1.0.2] - 2026-01-16

### Changed
- 格式化所有命令文件（统一缩进与换行）
- `.gitignore` 补充忽略规则

---

## [1.0.1] - 2026-01-15

### Added
- 新增 Agent 文件（14 个专项 Agent）
- 新增 telemetry 与 ErrorBoundary 错误处理

---

## [1.0.0] - 2026-01-11

### Added
- 初始化项目结构：`nova-plugin` + `.claude-plugin/marketplace.json`
- 17 个命令定义（Explore / Plan / Review / Implement / Finalize 五阶段）
- MIT 开源协议
- 中英双语 README 文档

[Unreleased]: https://github.com/lliangcol/llm-plugins-fusion/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/lliangcol/llm-plugins-fusion/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.9...v2.0.0
[1.0.9]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/lliangcol/llm-plugins-fusion/releases/tag/v1.0.0

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

---

## [Unreleased]

### Added
- 新增 `scripts/validate-all.mjs` 作为本地仓库校验总入口，并在 Windows 无 Bash 时明确 warning 跳过本地 `bash -n`。
- 新增 `scripts/validate-docs.mjs`，校验 Markdown 本地链接与锚点、命令文档 stage 覆盖、版本日期同步和报告归档状态。
- 新增 `.claude-plugin/marketplace.metadata.json` 与对应 schema，用于保存 marketplace 自定义 trust/risk/deprecation/date 元数据。
- 新增 `scripts/validate-claude-compat.mjs`，静态拦截 Claude CLI 拒绝的 marketplace 插件级字段，并在 Claude CLI 可用时运行插件兼容校验。

### Changed
- CI 与 release 预检接入 docs 校验；Codex 项目检查脚本补充 hooks、docs 和 hook `bash -n` 校验任务。
- 将 2026-04-28 项目状态审计报告移入 `docs/reports/archive/`，并在维护文档中明确历史报告状态。
- 将 `trust-level`、`risk-level`、`deprecated`、`last-updated` 从官方 marketplace manifest 拆分到 repository-local metadata，保持 `claude plugin validate .` 兼容。
- `/review` 统一入口现在明确支持 `LEVEL=lite|standard|strict`，并将 `lite` 路由到 `nova-review-lite`。
- CI、release 与 `validate-all` 接入 Claude 兼容校验，并增加 `/review LEVEL=lite` 文档契约防回归检查。
- 清理历史优化总结与 archive notice 中会误导 active agent 位置或历史文件路径的说明。

### Removed
- 删除已移除的辅助前端应用，并移除对应的 CI npm lint/test、同步检查脚本与 release 构建产物上传。

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

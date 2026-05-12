# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

---

## [Unreleased]

### Added
- 新增 `docs/releases/release-validation-runbook.md`，补充 exact tag、隔离
  plugin install smoke、人工 workflow evaluation、release evidence 组装和
  promotion 决策的维护者操作步骤。
- 新增 `fixtures/workflow/invoice-sync/` 公开安全五阶段 workflow evaluation
  fixture，为 `/explore`、`/produce-plan`、`/review`、`/implement-plan`、
  `/finalize-work` 提供脱敏输入、buggy review diff 和 approved plan。
- 新增 `docs/README.md` 仓库级文档总索引，集中维护 `docs/` 目录结构、
  当前文档清单、归档边界和文档维护规则。
- 新增 `docs/getting-started.md` 极简上手文档，聚焦安装、`/route`、五主命令、
  Codex 前置条件和常见失败处理。
- 新增无第三方依赖的 `package.json` 维护者便捷入口，提供 `validate`、
  `validate:docs`、`validate:schemas`、`validate:runtime`、
  `validate:regression`、`scan:distribution` 和 `scaffold:consumer`，并避免
  `check` / `lint` / `test` / `build` 脚本名。
- 新增 `scripts/scaffold-consumer-profile.mjs`，支持从 redacted consumer
  templates dry-run 或 `--write` 初始化 `java-backend`、`frontend`、`workbench`
  profile。
- 新增 `scripts/validate-regression.mjs`，用 Node 内置能力覆盖 registry 生成、
  分发风险扫描和 command/skill/docs drift 的关键回归。
- 新增 `scripts/distribution-risk.allowlist.json`，为历史归档风险发现提供
  redacted allowlisted warning 记录。
- 新增 `scripts/validate-surface-budget.mjs` 与 surface budget allowlist，
  用于限制公开 command、skill、agent 和 pack 文档表面积继续膨胀，并接入
  `validate-all`、CI、npm shortcut 与 release evidence。
- 新增 `docs/prompts/common/checkpoint-artifact.md`，为私有 consumer workbench
  中的长任务恢复点提供公共安全 prompt 模板。
- 新增 `docs/workflows/routing-validation-guardrails.md`，说明 `/route`、
  checkpoint evidence、surface budget 和 distribution-risk guardrails 的维护方式。
- 新增 `docs/workflows/verification-evidence-contract.md`，说明验证声明如何映射
  到行为、仓库事实、review finding 或变更目标。
- 新增 `docs/workflows/gsd-informed-hardening.md`，持久化记录 GSD-informed
  reliability hardening 的采纳项、非目标、维护规则和验证方式。

### Changed
- 收紧文件扫描与本地检查边界：`.gitignore` 不再放行 retired
  `.claude/agents/**`，文档校验、分发风险扫描和 Codex package script
  discovery 统一跳过 IDE、cache、coverage、logs、tmp/temp 等非源码目录。
- 将 broad repository file-tree scan 规则上移到 `CLAUDE.md`，`AGENTS.md`
  改为引用该 canonical 规则并只保留非 Claude agent 的执行差异说明。
- 增强 Claude hook 安全边界：pre-write 检测更多常见 token / secret 形态，
  post-audit 在写入 Bash 命令摘要前进行脱敏，并把覆盖加入 runtime smoke。
- `scripts/scaffold.mjs` 新增 `--docs-dir codex` / `--codex`，避免新增 Codex
  command 时把三份命令文档生成到普通 stage 目录。
- 将历史审计报告中的机器本地路径替换为脱敏占位，并清空对应分发风险
  allowlist。
- 在根 README、英文 overview、`nova-plugin/docs/README.md`、`AGENTS.md`
  和 `CLAUDE.md` 中补充仓库文档总索引与根目录文档入口，减少跨目录导航分散。
- 将 `AGENTS.md` 收敛为 Codex / 通用 agent 适配层，引用 `CLAUDE.md`
  承载共享仓库规范，避免两个 agent 规范文件大段重复。
- 收紧 frontend capability pack 与 agent routing 示例 wording，避免把 deferred
  public portal 误读为当前已实现的仓库能力。
- 将 `run-project-checks.sh` 从字符串命令执行改为显式 task dispatcher，移除
  shell `eval`，同时保持 repo checks、package script discovery、report file
  和 lint/test/build/all 模式。
- 扩展 runtime smoke，静态拦截 `run-project-checks.sh` 重新引入 `eval` 的风险。
- 扩展分发风险扫描，覆盖 JWT、npm token、Azure/GCP key、私有 SSH repo URL
  和真实 `.env` 值，并继续保证输出脱敏。
- 收敛 `2.2.0` release-ready 事实：在正式 tag、隔离环境 install smoke、
  GitHub Release 和人工 workflow evaluation 完成前，不把当前 snapshot 描述为
  stable release。
- 收紧 checkpoint 与 verification 输出契约：验证证据必须对应预期行为、
  仓库事实、review finding 或变更目标，不能只用测试通过替代行为或事实确认。
- 明确 `/route` / `nova-route` 是只读第一阶段路由器，先做 intent family
  分类，再推荐最小可执行下一步和必要验证建议。
- 扩展分发风险扫描与回归测试，拦截高风险 blanket permission 建议和已跟踪
  `.codex/` 运行时制品。
- 增加 Windows 非 Bash CI smoke lane，覆盖 schema、docs、frontmatter 和
  PowerShell agent verification，补齐本地 Windows skipped check 的替代证据。

### Removed
- 删除当前交付不再需要的中间、历史和临时文档，包括 retired
  `.claude/agents/` archive、过期 release 决策/证据草稿、临时 workflow
  evaluation 记录、历史报告归档和 `nova-plugin/docs/history/` 历史优化记录；
  保留当前 README、索引、规范、release hygiene、evidence template、routing
  和 marketplace 文档。

### Fixed
- 修正 Codex review/verify Bash helper 的参数解析：`--base`、
  `--output-dir`、`--review-file` 和 `--checks-file` 缺少值时现在会明确失败，
  不再依赖 `shift` 错误或把下一个 flag 当作参数值。

## [2.2.0] - 2026-05-12

Status: release-ready notes; the exact `v2.2.0` tag is pending in the current
local repository. Do not treat this section as published stable release evidence
until the tag and release workflow exist.

### Added
- 新增 `/route` 与 `nova-route` 只读路由入口，用于在非 Claude slash
  command 场景或任务意图不明确时选择下一步 nova command、skill、core
  agent、capability packs、必需输入和验证路径。
- 新增 `scripts/validate-plugin-install.mjs` 与 CI 安装 smoke test，覆盖
  `claude plugin validate`、marketplace add/list 和
  `nova-plugin@llm-plugins-fusion` user-scope 安装链路。
- 新增 `scripts/validate-runtime-smoke.mjs`，在不调用 Codex、不写入 `.codex/`
  的前提下校验分发 Bash 脚本语法、help 输出和安全失败路径。
- 新增 `scripts/scan-distribution-risk.mjs`，扫描活跃分发内容中的密钥、
  私有路径、私网地址和内部 endpoint，并将历史归档发现降级为 warning。
- 将 runtime smoke 与分发风险扫描接入 `scripts/validate-all.mjs`、CI 和
  release workflow。
- 新增 `docs/consumers/` consumer profile 契约与脱敏 Java backend / frontend
  接入模板，明确真实 profile 应保存在 consumer 项目本地。
- 新增 `docs/examples/` 脱敏 Java backend 与 frontend workflow 示例，用于说明
  profile、验证和 handoff 形态。
- 新增 `v3.0.0` readiness evidence 台账，用于记录多插件目录和 public portal
  启动门槛，并明确当前仍不启动 breaking 迁移。
- 新增项目优化方案，明确定位、可靠性、易用性、维护性、环境差异和稳定
  推广门槛的后续改进路径。
- 新增五阶段 workflow evaluation 示例和人工 review rubric，用于评估主命令
  输出质量而不是只依赖结构校验。
- 新增 release evidence 模板，用于记录 release/promotion 前的 exact tag、
  环境、校验结果和 skipped checks。
- 新增五阶段 workflow evaluation 记录模板与 archive context 测量模板，避免在
  未运行人工评估或 `/context` 测量时误报质量证据。
- 扩展 `scripts/validate-docs.mjs`，自动校验 `SECURITY.md` 当前 MINOR
  支持范围，并拦截活跃文档中陈旧的 `v1.x` 未来规划标签。
- 新增 context-safe agent workflow 指南，沉淀大任务拆分、review checkpoint、
  fix loop、交付文档和上下文治理规则。
- 新增 `docs/prompts/` prompt 模板库，覆盖 Codex review/verify、Claude Code
  review 修复、subagent/串行 checkpoint、交付文档和 workbench 整理。
- 新增可选 HTML workflow artifact 的公共安全 prompt 模板和配套指导，明确
  HTML 是计划、评审、报告和 handoff 的派生阅读制品，不替代事实源。
- 新增 public-safe Workbench consumer 模板，用于私有工作区需求、设计、
  review、fix、测试、prompt 和 handoff 资产治理。
- 新增 agent development stack 架构文档，说明 memory、skills、guardrails、
  delegation 和 distribution 五层维护边界。
- 新增 unreleased snapshot evidence 草稿，记录当前工作树验证结果、exact tag
  状态和未完成的人工 release evidence 项。
- 新增 `nova-plugin` 五层架构说明，将 memory、skills、guardrails、
  delegation 和 distribution 映射到事实源文件与质量门。

### Changed
- 将 `nova-plugin` 版本提升到 `2.2.0`，命令与 skill 数量扩展为 21 个一对一
  入口，并同步 marketplace metadata 的 `last-updated` 到 `2026-05-12`。
- 扩展核心写入、评审、Codex 和收尾 skills 的 rationalization、red flag 与
  verification 行为约束，减少跳过验证、扩大 scope 或误报结果的风险。
- 增强 docs/security/release capability packs，对官方文档 grounding、
  高风险 doubt-driven review、deprecation 和 migration 规划给出 fallback
  路由，不新增 pack 数量。
- 新增 Cursor、Gemini CLI、OpenCode、Copilot 和 Codex 的跨工具消费说明，
  明确非 Claude Code 环境如何引用 `nova-route` 和 `nova-*` skills。
- 将公开定位收敛为多项目 AI 工程工作流框架，保留 marketplace 作为安装/分发
  形式，并优先展示 `/explore`、`/produce-plan`、`/review`、
  `/implement-plan`、`/finalize-work` 五个主入口。
- 收敛 `nova-plugin` marketplace 描述，强调 workflow plugin、command/skill
  契约、consumer profile guidance 和 validation-aware handoff。
- 强化 README、英文 overview 和命令手册中的默认五命令上手路径，并将
  Codex CLI + Bash 前置条件放到 Codex 命令附近。
- 补充稳定 release tag 与 unreleased `main` 的推广边界，并在 release
  evidence 中加入五阶段 workflow evaluation 记录项。
- 增强 Java 与 Frontend capability pack 的通用检查点，覆盖事务、幂等、并发、
  DTO / Entity、异常模型、数据源、MQ / scheduled jobs、Maven 模块校验、
  observability、rollback，以及设计系统、响应式布局、状态管理、表单、
  loading/error/empty、可访问性、路由、组件结构和截图/Playwright 验证。
- 扩展 `scripts/validate-docs.mjs`，校验 README、英文 overview、AGENTS 和
  CLAUDE 中的 command、skill、active agent 和 capability pack 数量事实。
- 扩展 `scripts/validate-all.mjs`，输出 Node.js、Git、Claude CLI、Codex CLI、
  Bash、commit 和 exact tag 的环境摘要。
- Codex review/verify 脚本现在记录 runtime environment artifact，包含工作目录、
  脚本目录、Git/Bash/Node/Codex 路径和版本、`CODEX_MODEL` 与 `CODEX_PROFILE`。
- Codex 脚本现在会验证 `codex --version` 是否真的可执行，并在 Windows/WSL
  场景下 fallback 到可用的 `codex.exe`，避免 PATH 上的坏 shim 通过预检查后
  在实际 review/verify 时失败。
- `run-project-checks.sh` 现在同样支持 `node.exe` fallback，避免 WSL Bash
  环境找不到 `node` 时误判仓库级 Node 校验不可运行，并在 package script
  探测时转换 WSL/Git Bash 路径供 Windows Node 使用。
- `run-project-checks.sh` 现在覆盖 registry fixture 校验，使 Codex fix loop
  的本地 lint 范围与仓库级 release gate 保持一致。
- 将 `codex-review-only` 与 `codex-verify-only` 从 `none` 调整为 `low`
  artifact 风险，明确它们会运行 Bash 并写入 `.codex` review/verify artifact，
  但不得修改项目代码。
- `scripts/lint-frontmatter.mjs` 现在会识别显式只读 Bash guard，避免
  `/finalize-work` 这类只读 Git/环境探测命令产生误报，同时继续提示未声明边界
  的 `Bash` + `none` 组合。

### Removed
- 删除 `nova-plugin/docs` 中已历史化的 legacy agent 摘要文件，并将 agent
  入口统一指向仓库级当前 routing 文档。
- 删除已由 `docs/project-optimization-plan.md` 取代的
  `docs/reports/project-optimization-plan.html` 静态报告产物。

### Fixed
- 修正 `SECURITY.md` 支持范围中的当前 MINOR 版本说明，使其与 `2.2.0`
  发布状态保持一致。
- 修正 hooks 设计文档中过期的 `v1.1` / `v1.2` 未来计划标签，避免与当前
  发布基线混淆。
- 修正 `codex-review.sh --full` 与 `codex-verify.sh` 的 patch artifact，
  现在会包含未跟踪文件内容，而不是只提供未跟踪文件名。
- 修正文档中的机器本地绝对路径示例，避免活跃分发内容携带个人路径。
- 修正分发风险扫描日志会输出命中原文的问题，现在只报告文件、行号、类型和
  脱敏占位符。
- 修正 `run-project-checks.sh` 在 Bash 环境缺少 `node` 时静默跳过仓库 Node
  校验并误报成功的问题。
- 修正 runtime environment artifact 中版本命令失败会产生多行值的问题，保持
  `key=value` 输出稳定。

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

[Unreleased]: https://github.com/lliangcol/llm-plugins-fusion/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/lliangcol/llm-plugins-fusion/compare/v2.1.0...v2.2.0
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

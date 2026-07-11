# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

---

## [Unreleased]

## [2.4.1] - 2026-07-11

### Added
- 新增 canonical workflow permission source、原生 Claude invocation/tool
  frontmatter 生成器和 42 项 effective-permissions 报告。
- 新增 Claude Code 2.1.205 隔离安装 inventory、exact-tag 安装参数、真实只读
  route smoke 契约和机器可读 release evidence 聚合入口。
- 新增 namespaced command 迁移说明，保留 21 commands + 21 `nova-*` skills
  双 surface，不在补丁版本删除兼容入口。

### Changed
- 所有活动用户文档与 workflow prompt 统一使用 `/nova-plugin:<command>`；Stable
  marketplace 固定到 `@v2.4.1`，`@main` 明确为 Edge。
- command/skill frontmatter 改用 Claude 原生 `user-invocable`、
  `disable-model-invocation`、`allowed-tools` 和 `disallowed-tools`，并将自定义
  metadata 收敛为 Agent Skills 兼容的字符串键值。
- 移除活动 runtime surface 中的 `LS`、`MultiEdit` 和广泛 Bash 预授权；Bash
  调用回到正常权限流程。
- PreToolUse 和 PostToolUse Bash 文件收敛为薄启动器，Node.js 20+ 成为唯一
  hook 业务实现；write guard 的 `exit 0` 明确表示无决定而不是授权。
- 真实 route 发布门禁改用 `claude setup-token` 生成的
  `CLAUDE_CODE_OAUTH_TOKEN`，通过临时 HOME/XDG/Claude 配置目录保持隔离，且
  拒绝会抢占 OAuth 的 API key、Bearer token 或云厂商认证配置。

### Fixed
- write guard 在 Node 缺失、payload 非法或 Edit 无法可靠重构时不再静默放行。
- Edit hook 现在读取当前普通文件、应用 `old_string/new_string/replace_all` 后
  校验完整 proposed `hooks.json`，避免把 replacement fragment 当作完整 JSON。
- Stable 安装、实际 42 项组件 surface、首次 namespaced route 和发布证据不再
  只由仓库内部 validator 间接推断。
- route smoke 现在逐项校验 command、skill、core agent 和 capability pack，
  并比较完整临时 worktree inventory，而不是只比较 README 与 Git status。
- Write guard 现在拒绝已有符号链接或非普通文件目标；NotebookEdit 纳入
  Pre/Post hook matcher，并因无法可靠重构完整 notebook 内容而 fail closed。
- release evidence 现在拒绝 skipped gate、错误 tag/version、inventory 漂移、
  不一致 tree digest 和不完整 route 证据；weekly latest-drift 在失败前保留
  missing/unexpected Skills 的结构化差异。
- exact-tag 安装树 digest 仅在 installed tree 侧忽略 Claude 运行时生成的
  `.in_use/**` 锁标记，避免进程号导致跨平台误报；Claude 2.1.205 live smoke
  改用其声明支持的 Node.js 22。
- OAuth route smoke 仅预授权只读的 `Skill(nova-plugin:route)` wrapper 和
  `Skill(nova-plugin:nova-route)` 兼容实现，继续禁止文件编辑与 Bash；release
  evidence 会拒绝偏离该权限策略的结果。
- OAuth route smoke 在稳定 command wrapper 与 canonical headless system
  prompt 中重复固定 `## Recommended Route` 七字段契约；release evidence 绑定
  contract ID、prompt digest 与 turn limit，失败日志仅记录隐私安全的结构摘要。

## [2.4.0] - 2026-07-11

### Added
- 新增依赖为零的 SemVer 2.0.0 解析与安全 release metadata 准备脚本，
  支持 prerelease/build metadata，并避免 tag 或 step output 直接进入 shell。
- 新增完整维护代码覆盖率 inventory：所有受 Git 跟踪、非 `tests/**` 的
  `.mjs` 自动进入 V8 evidence 对账和覆盖率分母，遗漏任一模块即失败。
- 新增 generated surface inventory：`scripts/generate-surface-inventory.mjs`
  生成并校验 `docs/generated/surface-inventory.json` 与 `.md`，覆盖
  command、skill、active agent、capability pack 和 generated marketplace
  output 清单，并接入 `validate-all`、CI 和集成测试。
- 新增 CI required checks：`NPM Test`、`ShellCheck`、`PSScriptAnalyzer`、
  `macOS Smoke` 和 `Validate Surface Inventory`，补齐测试门禁、shell/
  PowerShell 静态分析、macOS 平台 smoke 和 surface inventory 漂移信号。
- Release workflow 新增 exact-tag isolated install smoke job，上传
  `release-install-smoke-evidence` artifact，并在 GitHub Release 创建前阻断
  真实安装路径失败。
- 新增 `nova-plugin/runtime/secret-rules.mjs` 与 `bash-common.sh`，为 hook、
  Codex helper 和 distribution scan 提供共享的 secret detection / redaction
  runtime。
- 新增 `docs/privacy/data-handling.md`，记录本地 audit log 位置、权限、轮转、
  禁用方式和 public-safe 数据处理边界。

### Changed
- Release workflow 通过环境变量和校验后的 GitHub outputs 传递版本、
  prerelease 状态与 release notes，不再使用可注入的 shell 插值或连字符猜测。
- GitHub Actions 外部 action 引用改为 full commit SHA pin，并由
  `scripts/validate-github-workflows.mjs` 校验 SHA pin、tag 注释、`NPM Test`
  gate、required-check 文档和 print 输出同步。
- `npm test` 拆分为 `test:unit`、`test:integration` 和 `test:e2e`，并由
  `npm run validate:maintainer` 逐项运行后再执行默认质量门、registry drift
  和 whitespace checks。
- Hook audit logging、pre-write secret blocking、Codex review helpers 和
  distribution risk scan 现在复用同一组 token / secret 规则；redaction helper
  不可用时 audit log 记录占位摘要而不是回显 command text。
- 贡献、维护者、release 和 adapter 文档同步说明开放受控 issue intake、
  action pinning、isolated release install smoke、surface inventory 和新增 CI
  checks。
- `test:coverage:check` 现在执行 lines 85%、branches 60%、functions 90% 的
  固定发布阻断基线，并验证完整维护 `.mjs` inventory；普通 coverage 命令仍
  保持 collection-only。
- maintainer wrapper 和通用 process runner 现在只使用参数数组与
  `shell: false`；Windows 显式调用 `npm.cmd`，其他平台调用 `npm`。
- `--out`、`--coverage-dir`、`--root` 等 CLI option 统一使用严格 value
  校验，下一 token 为 option 时直接失败且不产生文件副作用。
- Coverage evidence 清理范围收敛为 runner 自有的 `v8/` 子目录，不再递归
  删除整个 `--coverage-dir`；SemVer 核心数字段保持字符串精度。
- Codex helper 的兼容边界明确为 Bash 3.2+，migration CLI、read-only Bash
  scaffold 和 `/nova-plugin:senior-explore` 参数/导出契约同步收敛。

### Fixed
- Bash 与 Node audit log 只有在轮转重命名成功后才创建新日志；轮转失败时
  保留原字节并受限追加，避免意外截断审计证据。
- project checks 汇总改为 `selected/passed/failed`，失败场景不再误报
  “无任务”，并兼容 Bash 3.2 的空 package inventory。
- Markdown heading entity 改为单次解码，避免 `&amp;lt;` 被重复解释；
  validate-all E2E smoke 超时提升到 180 秒并输出阶段、耗时及截断诊断。
- 修复 Node 20 无法展开测试 glob 导致 `NPM Test` 与 `Test Coverage` CI 失败，
  普通测试和 coverage 现在复用显式、确定性测试文件发现。
- 修复 macOS 系统 Bash 3.2 因 `mapfile` 无法运行 Codex helper，并清理当前
  ShellCheck 诊断。
- 修复 `verify-agents.sh` 在 `pipefail` 下因 `grep -q` 提前退出触发 broken
  pipe、进而在 macOS runner 误判合法 agent 文件的问题。
- `verify-agents.sh` 现在在 `awk` 内先规范化行尾 `\r`，使 CRLF agent 的
  frontmatter 与正文分隔符和 LF 文件保持同样的验证行为。
- 回归测试的 prompt 文档负向 fixture 改为按 Markdown heading 边界确定性
  变异并立即校验，避免平台文本差异导致预期错误集合偶发缺项。
- 补齐 workflow evaluation 的依赖为零 runnable fixture，使
  `/nova-plugin:implement-plan` 人工门禁能够真实修复顺序缺陷并运行聚焦测试，而不是因
  只有局部 patch、缺少源码和测试入口而停止。
- distribution risk scan 现在覆盖 patch、常见源码/配置和未知文本扩展，扫描
  1 MiB 以上文本，并对超过 10 MiB 的文本 fail closed。
- Bash 与 Node audit hook 现在把不可信字段脱敏、单行化并限制长度，阻止换行
  注入伪造日志记录。
- 修正文档当前版本漂移、失效 v1 GitHub 链接、不可获取的 schema `$id` 和
  `nova-senior-explore` 内部契约冲突，并为这些事实增加防漂移验证。

## [2.4.0-rc.1] - 2026-07-11

### Changed
- 发布 `2.4.0` 的候选版本；稳定版保留同一能力与兼容边界，并在 RC 的精确
  提交上完成维护者门禁、覆盖率、CodeQL、隔离安装和五阶段 workflow 质量验收。

## [2.3.0] - 2026-07-08

### Added
- 新增 `scripts/doctor.mjs` 与 `npm run doctor`，以只读方式汇总 Node/Git/Bash/
  Claude/Codex、版本、exact tag、工作区状态和 generated registry 漂移状态。
- 新增 `scripts/validate-maintainer.mjs` 与 `npm run validate:maintainer`，把
  默认质量门、registry 生成漂移检查和 `git diff --check` 收敛为维护者发布前入口。
- 新增 `npm run validate:drift`，作为 generated marketplace、metadata 和 catalog
  漂移的聚焦检查，并接入 CI required-check 清单。
- 新增 `npm run scan:secrets` 与 `Secret Scan` CI check，复用 source-owned
  distribution-risk scanner，为 PR 页面提供独立的 secret/private-data 扫描信号。
- 新增 `scripts/validate-workflow-fixtures.mjs` 与 `npm run validate:workflow`，
  自动校验 `fixtures/workflow/invoice-sync/` 的 public-safe fixture 合约、
  ordering bug 信号、approved plan 边界和 workflow rubric 覆盖。
- 新增 `scripts/validate-github-workflows.mjs`，独立校验 GitHub Actions
  token scope、`pull_request_target` 禁用边界、release job 写权限下放和
  mutating plugin install smoke 隔离触发器。
- 新增 `npm run validate:github-workflows`，让维护者无需记忆脚本路径即可
  单独验证 GitHub Actions workflow 权限合约。
- 新增 `docs/workflows/source-controlled-checks.md`，定义 source-controlled
  workflow checks、未来 `.nova/checks` 边界和当前 fixture validator 的职责。
- 新增 `docs/releases/release-validation-runbook.md`，补充 exact tag、隔离
  plugin install smoke、人工 workflow evaluation、release evidence 组装和
  promotion 决策的维护者操作步骤。
- 新增 `fixtures/workflow/invoice-sync/` 公开安全五阶段 workflow evaluation
  fixture，为 `/nova-plugin:explore`、`/nova-plugin:produce-plan`、`/nova-plugin:review`、`/nova-plugin:implement-plan`、
  `/nova-plugin:finalize-work` 提供脱敏输入、buggy review diff 和 approved plan。
- 新增 `docs/README.md` 仓库级文档总索引，集中维护 `docs/` 目录结构、
  当前文档清单、归档边界和文档维护规则。
- 新增 `docs/getting-started.md` 极简上手文档，聚焦安装、`/nova-plugin:route`、五主命令、
  Codex 前置条件和常见失败处理。
- 新增 Cline、Aider 和 OpenHands consumer setup 文档，补齐 multi-assistant
  Markdown skill consumption 的 public-safe 指引与验证边界。
- 新增无第三方依赖的 `package.json` 维护者便捷入口，提供 `validate`、
  `validate:docs`、`validate:schemas`、`validate:runtime`、
  `validate:regression`、`scan:distribution`、`lint`、`test` 和
  `scaffold:consumer`，并避免 `check` / `build` 脚本名。
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
- 新增 `docs/workflows/routing-validation-guardrails.md`，说明 `/nova-plugin:route`、
  checkpoint evidence、surface budget 和 distribution-risk guardrails 的维护方式。
- 新增 `docs/workflows/verification-evidence-contract.md`，说明验证声明如何映射
  到行为、仓库事实、review finding 或变更目标。
- 新增 `docs/workflows/gsd-informed-hardening.md`，持久化记录 GSD-informed
  reliability hardening 的采纳项、非目标、维护规则和验证方式。
- 新增 GitHub issue forms、Dependabot GitHub Actions 更新配置和 Dependency
  Review workflow，用于公开安全反馈、依赖更新和 PR 依赖审查。
- 新增 `docs/showcase/`、`docs/assets/`、`docs/growth/` 和
  `docs/assets/social-preview-1280x640.png`，补充首次访问者 showcase、社交
  预览、demo capture 和增长指标口径。
- 新增 `scripts/collect-github-metrics.mjs`，采集公开 GitHub repository 指标，
  并在无 `GITHUB_TOKEN` 时把 owner-only traffic endpoints 记录为 skipped。
- 新增 `tests/e2e/doctor.test.mjs`，固定 `npm run doctor` 的只读诊断输出契约，
  并确保 Claude/Codex CLI 缺失仍作为 warning 而非硬失败处理。

### Changed
- Release validation now writes a CI-only validation evidence artifact with
  maintainer-gate timing data, and plugin install smoke uploads context for
  successful runs as well as failures.
- Codex verify 现在与 review 的未跟踪文件内容边界保持一致：默认只列出未跟踪
  文件名，只有显式 `INCLUDE_UNTRACKED_CONTENT=true` / `--include-untracked-content`
  且通过安全检查后才会把内容写入 verify patch；同时同步 Codex command / skill
  参数文档。
- 扩展 `scripts/validate-docs.mjs` 与 regression 覆盖，校验公开定位、
  exact release tag 推广边界和 maintainer diagnostic warning 语义，防止
  moving `main`、public portal 或 skipped Bash check 被误报为稳定发布证据。
- GitHub workflow 权限合约现在从 `validate-docs` 拆到
  `scripts/validate-github-workflows.mjs`，并接入 `validate-all`、CI 与
  regression，防止公开仓库 CI 漂移成宽权限默认路径；该验证器同时校验
  CI job labels、GitHub security settings 文档和只读打印脚本的 required-check
  清单一致性，并固定 `.github/workflows/` 文件库存与 `CLAUDE.md` repository
  layout 的同步关系；README、`CLAUDE.md` 和项目优化计划中的质量门覆盖叙述
  也同步说明权限、库存和 required-check 合约，维护者 quickstart、
  troubleshooting、marketplace trust policy、security review route、registry
  author workflow 与 compatibility matrix 入口同步描述完整验证范围；release
  workflow 收敛到维护者验证入口并对空 release notes fail-closed；release
  hygiene、runbook 和 evidence template 也把 `validate-github-workflows` 作为
  独立发布证据项记录。
- GitHub Actions workflow 依赖升级到当前 major line：`actions/checkout@v7`、
  `actions/setup-node@v6`、`actions/upload-artifact@v7`、
  `actions/dependency-review-action@v5`、`github/codeql-action@v4` 和
  `softprops/action-gh-release@v3`，避免 CodeQL v3 等旧 runtime 路径继续漂移。
- GitHub security settings 的 suggested required-check 清单和只读打印脚本
  现在包含 `Validate GitHub Workflows`，与 CI 实际 job 覆盖保持一致。
- 补强中英文命令手册中的 Codex 高级路径边界，明确 review / verify artifact、
  `.codex/` 本地证据、fallback workflow 和全局权限放宽的非默认地位。
- `scripts/scaffold-consumer-profile.mjs` 现在拒绝把 `--write` 输出写入当前
  公共仓库 checkout，避免误把私有 consumer profile 初始化到公开分发面。
- 统一 Codex 与 OpenCode consumer setup 的 public/private 边界，明确 `.codex/`
  runtime artifact、私有规则、缺失工具 fallback 和全局权限放宽的非默认地位。
- `scripts/validate-workflow-fixtures.mjs` 现在校验 workflow examples 和
  disposable fixture 保留 public-safe / redacted 边界声明，防止 release
  evaluation 示例漂移成真实 consumer 细节。
- `scripts/validate-docs.mjs` 现在校验 showcase public-safe / private-context
  边界，并由 regression 覆盖，防止展示页漂移成真实 consumer 或 portal 叙事。
- 仓库文档索引现在明确 `docs/showcase/` 和 `docs/examples/` 是 public-safe
  navigation aids，而不是 public portal 或真实 consumer 案例库，并由
  `validate-docs` / regression 固定。
- `CLAUDE.md` 与项目优化计划中的 `validate-docs` 覆盖面说明现在同步包含
  docs index navigation 与 showcase public-safety 合约，并由 regression 防漂移。
- `docs/growth/` 现在明确增长指标只是本地公开口径，不是 public portal、
  付费 marketplace、自动发布 workflow 或 owner-only analytics 发布面；
  `validate-docs` / regression 已固定相关隐私和 exact-tag 边界。
- `docs/assets/` 现在明确视觉资产和 demo capture 指南不是 public portal、
  托管 demo、自动推广 workflow 或 release evidence 替代品；`validate-docs` /
  regression 已固定手动动作、录屏证据、skipped-check 和隐私边界。
- `docs/marketplace/portal-information-architecture.md` 现在明确自身不是已实现
  public portal、托管 marketplace、frontend app、部署计划或 `v3.0.0` 激活证据；
  `validate-docs` / regression 已固定 deferred portal IA 边界。
- `docs/marketplace/v3-readiness-evidence.md` 现在明确 registry fixture 只能证明
  generator 行为，不能作为生产多插件目录、`v3.0.0` 激活或安装路径迁移证据；
  `validate-docs` / regression 已固定 v3 readiness evidence 边界。
- `scripts/validate-packs.mjs` 现在固定 capability packs 的 documentation-only、
  optional enhanced mode、required fallback mode 和 no runtime dynamic loading
  边界，并由 regression 覆盖漂移场景。
- `scripts/verify-agents.sh` 与 `scripts/verify-agents.ps1` 现在把
  `.claude/agents/`、`docs/reports/` 和 `nova-plugin/docs/history/` 作为 retired
  active-agent surface 硬边界，防止归档路径重新进入当前公开交付面。
- `scripts/validate-docs.mjs` 现在固定 consumer profile 文档的公开/私有边界：
  真实 profile、`.codex/` runtime 证据、私有配置和全局权限放宽建议不得漂移进
  公开 setup 指南，并由 regression 覆盖。
- Cursor、Gemini CLI 与 GitHub Copilot consumer setup 文档现在固定私有事实、
  私有配置和缺失验证工具的权限绕过边界，`validate-docs` / regression 已覆盖。
- Java backend 与 frontend consumer 脱敏模板的 placeholder、私有事实、
  destructive/public portal 边界现在由 `validate-docs` / regression 固定。
- Prompt template library 现在固定 public-safe placeholders、私有事实、
  HTML 派生制品 source-of-truth、离线输出和 workbench tidy 边界。
- Workflow evidence 文档中的 source-controlled checks、verification evidence
  和 routing guardrail 边界现在由 `validate-docs` / regression 固定，避免漂移成
  新 runtime、CI 层、跳过检查算 passed 或默认权限绕过建议。
- Release evidence 文档中的 exact tag、skipped-check replacement、isolated
  install smoke、manual workflow evidence 和缺证据不得 promote 规则现在由
  `validate-docs` / regression 固定。
- Maintainer troubleshooting 与 GitHub security settings 文档现在明确缺失工具
  或平台检查不能靠放宽权限掩盖，owner-only 安全细节不得进入公开文档，并由
  `validate-docs` / regression 固定。
- Public API compatibility 文档现在明确稳定 API 不包含 public portal、付费
  marketplace、生产多插件目录、runtime dynamic loading 或私有 consumer 内容，
  并由 `validate-docs` / regression 固定。
- Marketplace trust policy 与 security review route 现在固定 repository-local
  metadata、public-safe disclosure、私有漏洞上报和权限绕过边界，并由
  `validate-docs` / regression 固定。
- Registry author workflow 与 compatibility matrix 现在固定当前单插件范围、
  fixture-only 证据、optional enhanced tools、public-safe evidence 和权限边界，
  并由 `validate-docs` / regression 固定。
- CONTRIBUTING 与 PR template 现在固定公开贡献边界、私有事实脱敏、deferred
  capability 和缺失工具不得靠权限放宽掩盖的规则，并由 `validate-docs` /
  regression 固定。
- GitHub issue templates 现在固定 public-safe bug / feature / showcase intake、
  私有漏洞上报、deferred capability、缺失检查和 no permission bypass 边界，
  并由 `validate-docs` / regression 固定。
- `scripts/validate-plugin-install.mjs` 现在默认拒绝 mutating install/update；
  `--dry-run` 只打印计划步骤，实际 user-scope 安装 smoke 必须显式传入
  `--accept-user-scope-mutation` 或 `--yes`，CI 和 release workflow 已同步。
- `scripts/validate-all.mjs` 接入 Node 20 preflight 和 workflow fixture 验证；
  `package.json` 增加 `engines.node` 并暴露 `doctor`、`validate:maintainer`
  和 `validate:workflow` npm 入口。
- 收敛只读 explore/plan/review/finalize-lite/route skills 的 artifact wording，
  明确当前调用默认 chat output，不得把通用 artifact 模板误读为可写项目文件。
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
- 清理 `2.2.0` 推广口径：正式 tag 和 release 已存在后，公开入口统一使用
  exact `v2.2.0` 作为稳定推广基线，同时继续区分 moving `main` 与 release。
- 收紧 checkpoint 与 verification 输出契约：验证证据必须对应预期行为、
  仓库事实、review finding 或变更目标，不能只用测试通过替代行为或事实确认。
- 明确 `/nova-plugin:route` / `nova-route` 是只读第一阶段路由器，先做 intent family
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
- 修正分发风险扫描按 basename 跳过 `out`、`dist`、`build` 等目录时可能
  漏扫未来已跟踪内容的问题；已跟踪文件位于这些目录下时仍会进入扫描。
- 修正 Codex review/verify Bash helper 的参数解析：`--base`、
  `--output-dir`、`--review-file` 和 `--checks-file` 缺少值时现在会明确失败，
  不再依赖 `shift` 错误或把下一个 flag 当作参数值。

## [2.2.0] - 2026-05-12

Status: stable release notes for exact `v2.2.0`. Use the published release tag
as promotion evidence; moving `main` may contain later `Unreleased` changes and
must not replace the exact release tag as stable evidence.

### Added
- 新增 `/nova-plugin:route` 与 `nova-route` 只读路由入口，用于在非 Claude slash
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
  形式，并优先展示 `/nova-plugin:explore`、`/nova-plugin:produce-plan`、`/nova-plugin:review`、
  `/nova-plugin:implement-plan`、`/nova-plugin:finalize-work` 五个主入口。
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
- `run-project-checks.sh` 现在补齐 GitHub workflow、surface budget 和
  workflow fixture 校验，使 Codex fix loop 的本地 repo-check 范围与
  默认质量门保持一致。
- 将 `codex-review-only` 与 `codex-verify-only` 从 `none` 调整为 `low`
  artifact 风险，明确它们会运行 Bash 并写入 `.codex` review/verify artifact，
  但不得修改项目代码。
- `scripts/lint-frontmatter.mjs` 现在会识别显式只读 Bash guard，避免
  `/nova-plugin:finalize-work` 这类只读 Git/环境探测命令产生误报，同时继续提示未声明边界
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
- Commands 兼容：20 个 Claude Code command 文件继续保留，`/nova-plugin:review-lite`、`/nova-plugin:review-only`、`/nova-plugin:review-strict` 等兼容入口仍可使用。
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
- `/nova-plugin:review` 统一入口现在明确支持 `LEVEL=lite|standard|strict`，并将 `lite` 路由到 `nova-review-lite`。
- CI、release 与 `validate-all` 接入 Claude 兼容校验，并增加 `/nova-plugin:review LEVEL=lite` 文档契约防回归检查。
- 清理历史优化总结与 archive notice 中会误导 active agent 位置或历史文件路径的说明。
- 记录 `2.0.0` 正式发布前的本地全量校验结果，明确 hook Bash 语法检查已实际执行且无 skipped 项。

### Removed
- 删除已移除的辅助前端应用，并移除对应的 CI npm lint/test、同步检查脚本与 release 构建产物上传。

### Fixed
- 修复 docs 锚点校验中同一标题 slug 候选重复计数的问题，避免不存在的重复标题锚点被误判为有效。
- 收紧 schema 校验：`format: date` 现在校验真实日历日期，并检测 registry / marketplace / metadata 插件条目的重复 source 或 name。
- release workflow 现在校验 tag 版本必须匹配 `nova-plugin/.claude-plugin/plugin.json` 中的插件版本，避免错误 tag 生成不一致 release。
- 修复 Codex 闭环本地检查未覆盖 Claude 兼容性与 capability pack 校验的问题，避免 `/nova-plugin:codex-review-fix` 的本地验证范围弱于仓库质量门。
- 新一轮 Codex review 成功后同步清理旧 `verify.md` 与 `checks.txt`，防止 verify 自动读取上一轮检查产物。
- 修正路线图与贡献清单中 schema 扩展边界、Claude 兼容性校验和 `validate-all` 覆盖范围的过期描述。

## 1.0.9 - 2026-05-04

### Added
- 新增 `nova-plugin/skills/_shared/` 通用策略文档，统一参数解析、安全 preflight、输出契约、artifact 写入规则与 agent routing 边界。
- `scripts/lint-frontmatter.mjs` 增加 command description、command/skill 一对一映射、skill 标准章节、安全 preflight 引用、`allowed-tools` 与 destructive action 一致性校验。

### Changed
- 移除 `nova-plugin/.claude-plugin/plugin.json` 中当前 Claude CLI 不接受或仅属于 marketplace 的字段，并保留 marketplace entry 中的展示元数据。
- 20 个 command 补齐 Claude command `description`，并收敛为 thin slash wrapper；详细行为规则迁移到对应 `SKILL.md`。
- 20 个 skill 增加标准 `Inputs`、`Parameter Resolution`、`Safety Preflight`、输出与失败模式章节，并保留原 command 行为契约作为 skill 事实源。
- 同步 `nova-plugin` 与 marketplace 版本至 1.0.9。

## 1.0.8 - 2026-04-21

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

## 1.0.7 - 2026-03-26

### Added
- 新增 `nova-codex-review-fix` 技能包，提供 Codex review -> Claude Code fix -> local checks -> Codex verify 半自动闭环
- 新增 `codex-review-fix`、`codex-review-only`、`codex-verify-only` 三个命令及对应 skills / docs
- 新增外部 Bash 脚本与 prompt 模板，用于 review、verify 和统一项目校验

### Changed
- 更新根 README、skills 索引、命令文档导航与版本号

---

## 1.0.6 - 2026-02-12

### Added
- 新增 nova-plugin Skills 目录，17 个命令均配套对应的 SKILL.md 技能文件
- Skills 支持 Claude Code 自动发现与调用（`nova-*` 命名空间）

---

## 1.0.5 - 2026-02-06

### Changed
- 格式化多处文档，统一代码块和章节排版
- 修改网站链接和徽章引用地址

### Added
- 更新 17 个命令文件内容，补充使用示例和约束说明

---

## 1.0.4 - 2026-02-03

### Changed
- 优化 14 个专项 Agent 的描述和路由规则
- 调整 orchestrator agent 的任务分发逻辑

---

## 1.0.3 - 2026-01-22

### Added
- 新增多篇使用文档（中英双语）
- 补充 Agent 概览说明与使用场景示例

### Changed
- 修正 README 标题格式
- 更新版本号至 1.0.3

---

## 1.0.2 - 2026-01-16

### Changed
- 格式化所有命令文件（统一缩进与换行）
- `.gitignore` 补充忽略规则

---

## 1.0.1 - 2026-01-15

### Added
- 新增 Agent 文件（14 个专项 Agent）
- 新增 telemetry 与 ErrorBoundary 错误处理

---

## 1.0.0 - 2026-01-11

### Added
- 初始化项目结构：`nova-plugin` + `.claude-plugin/marketplace.json`
- 17 个命令定义（Explore / Plan / Review / Implement / Finalize 五阶段）
- MIT 开源协议
- 中英双语 README 文档

[Unreleased]: https://github.com/lliangcol/llm-plugins-fusion/compare/v2.4.1...HEAD
[2.4.1]: https://github.com/lliangcol/llm-plugins-fusion/compare/v2.4.0...v2.4.1
[2.4.0]: https://github.com/lliangcol/llm-plugins-fusion/compare/v2.4.0-rc.1...v2.4.0
[2.4.0-rc.1]: https://github.com/lliangcol/llm-plugins-fusion/compare/v2.3.0...v2.4.0-rc.1
[2.3.0]: https://github.com/lliangcol/llm-plugins-fusion/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/lliangcol/llm-plugins-fusion/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/lliangcol/llm-plugins-fusion/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/lliangcol/llm-plugins-fusion/releases/tag/v2.0.0

中文 | [English](nova-plugin/docs/overview/README.en.md)

<div align="center">

# LLM Plugins Fusion

**公开的多项目 AI 工程工作流框架，提供 `nova-plugin` 工作流、consumer profile 契约和脱敏模板**

[![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)](https://github.com/lliangcol/llm-plugins-fusion)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

</div>

---

## 项目定位

`llm-plugins-fusion` 是一个公开的多项目 AI 工程工作流框架。目前主交付物是 `nova-plugin`，通过 Claude Code marketplace 形式安装和分发，提供从理解问题到交付总结的工程化命令体系：

```text
Explore -> Plan -> Review -> Implement -> Finalize
```

仓库可以支持闭源 consumer 项目接入，但公开内容只沉淀通用工作流、consumer profile 契约、脱敏 Java 后端/前端模板和通用 capability pack 指南。真实 consumer profile 应保存在 consumer 自己的 `AGENTS.md`、`CLAUDE.md`、`.claude/` 或私有文档中。

Marketplace 是当前安装与分发形式；本仓库不把当前状态描述为成熟的多插件生态，也不要求已有 public portal。

它适合以下使用者：

| 使用者 | 关注点 | 推荐入口 |
| --- | --- | --- |
| Consumer 项目维护者 | 接入通用 workflow、维护私有 profile、选择验证边界 | [Consumer profiles](./docs/consumers/README.md)、[Examples](./docs/examples/README.md)、[Command Map](#command-map) |
| 插件用户 | 安装 `nova-plugin`、选择命令、复制使用模板 | [Getting Started](./docs/getting-started.md)、[Quick Start](#quick-start)、[Command Map](#command-map)、[文档索引](./nova-plugin/docs/README.md) |
| 插件作者 | 新增 command / skill、理解 frontmatter 契约 | [CONTRIBUTING.md](./CONTRIBUTING.md)、[Skill-first 设计](./nova-plugin/docs/architecture/dual-track-design.md) |
| 维护者 | schema、CI、本地校验、发布与安全边界 | [Quality Gates](#quality-gates)、[SECURITY.md](./SECURITY.md)、[CHANGELOG.md](./CHANGELOG.md) |

适合使用：

- 已经使用 Claude Code，并希望用固定的 explore / plan / review / implement / finalize 节奏管理 AI 编码工作。
- 维护多个项目，需要把通用工作流留在公开仓库，把真实 consumer profile 留在私有项目。
- 希望用 schema、frontmatter、文档覆盖和 release hygiene 降低插件维护漂移。

暂不适合：

- 需要成熟多插件 marketplace、公开 portal、付费分发或托管 registry。
- 需要强运行时自动化平台，而不是 Claude Code command / skill 工作流。
- 需要把真实闭源项目配置、endpoint、凭据或私有知识库写入公开仓库。

## 当前状态

<table>
<tr>
<td><strong>插件版本</strong></td>
<td>2.2.0</td>
</tr>
<tr>
<td><strong>主插件</strong></td>
<td><code>nova-plugin</code></td>
</tr>
<tr>
<td><strong>命令 / Skills</strong></td>
<td>21 个命令，21 个一对一 skills</td>
</tr>
<tr>
<td><strong>Active agents</strong></td>
<td>6 个 core agents，位于 <code>nova-plugin/agents/</code>；8 个 capability packs，位于 <code>nova-plugin/packs/</code></td>
</tr>
<tr>
<td><strong>许可协议</strong></td>
<td>MIT</td>
</tr>
</table>

仓库当前的默认自动化质量门覆盖 schema、registry fixture、Claude 兼容性、command / skill frontmatter、core agent 集合、capability pack 结构、hooks 配置、Codex Bash runtime smoke、分发风险扫描、核心回归检查、Markdown 本地链接、命令文档覆盖与生成 catalog 漂移。CI 另跑 Claude 插件安装 smoke test。默认本地检查入口是：

```bash
node scripts/validate-all.mjs
```

维护者也可以使用不引入依赖的 npm 便捷入口；这些脚本刻意不使用 `check`、
`lint`、`test` 或 `build` 名称，避免被 Codex 项目检查脚本重复自动发现：

```bash
npm run validate
npm run validate:docs
npm run validate:schemas
npm run validate:runtime
npm run validate:regression
npm run scan:distribution
```

Consumer profile scaffold 需要参数；npm 入口示例：

```bash
npm run scaffold:consumer -- --type java-backend --out <dir>
```

Windows PowerShell 可以运行 Node 校验和 `scripts/verify-agents.ps1`。如果本机没有 Bash，`validate-all` 会 warning 跳过本地 Bash-dependent hook syntax 与 runtime smoke 检查；CI/Linux 仍会执行并要求通过。

## 稳定发布与推广口径

当前稳定推广对象是正式 release tag，例如 `v2.2.0`。当前 `main` 可能包含 `CHANGELOG.md` `Unreleased` 下的后续文档或优化工作，不能描述为稳定版本，也不能替代 release tag 做安装、推广或发布证据。

发布或推广前必须使用 [release evidence template](./docs/releases/release-evidence-template.md) 记录目标 commit、exact tag、`node scripts/validate-all.mjs`、`git diff --check`、Bash hook syntax 检查、Codex runtime smoke、分发风险扫描和 skipped checks。Windows 本地如果因为没有 Bash 得到 skipped checks，只能描述为“本地结构校验通过但 Bash 相关检查未本地执行”，需要 CI/Linux 的结果作为补充证据。

## Quick Start

最短上手路径见 [docs/getting-started.md](./docs/getting-started.md)；本节保留
安装命令和默认 workflow 摘要。

### 前置条件

- Claude Code 插件市场可用，并允许添加第三方 marketplace。
- 使用普通 `nova-plugin` 命令时，只需要安装插件。
- 使用 Codex 闭环命令时，需要本机可调用 Codex CLI，并需要 Bash 执行随 skill 分发的脚本。
- 维护本仓库或运行本地校验时，需要 Node.js 20+。

### 安装

在 Claude Code 中添加 marketplace：

```bash
/plugin marketplace add lliangcol/llm-plugins-fusion
```

安装主插件：

```bash
/plugin install nova-plugin@llm-plugins-fusion
```

确认插件可用：

```bash
/plugin
```

开始使用：

```bash
/explore 分析当前项目结构和主要风险
```

如果不确定从哪个命令开始：

```bash
/route 这项任务涉及文档、版本和安装验证，请推荐下一步 nova workflow
```

私有 consumer 项目应先在项目本地维护 profile，再按 profile 指定的规则和校验命令执行工作流。公开 profile 契约见 [docs/consumers/](./docs/consumers/README.md)。

### 默认工作流

```text
/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
```

| 当前目标 | 默认命令 | 说明 |
| --- | --- | --- |
| 先理解问题，不要方案 | `/explore` | 只收集事实、不确定性和风险信号。 |
| 需要可评审计划 | `/produce-plan` | 写出正式计划，供后续 review 和 implementation 使用。 |
| 审查计划、代码或风险 | `/review` | 默认标准级别，可用 `LEVEL=lite|strict` 调整深度。 |
| 按已批准计划实施 | `/implement-plan` | 需要明确的 plan 和 `PLAN_APPROVED=true`。 |
| 交付总结和后续事项 | `/finalize-work` | 冻结现状，生成交付说明，不再扩 scope。 |

最小可复制示例：

| 命令 | 示例 |
| --- | --- |
| `/explore` | `/explore 梳理这个需求的事实、不确定性和风险，不要给方案` |
| `/produce-plan` | `/produce-plan PLAN_OUTPUT_PATH=docs/plans/example.md PLAN_INTENT="为已确认需求写可评审计划"` |
| `/review` | `/review LEVEL=standard 请评审这个计划或 diff，按严重级别输出 findings` |
| `/implement-plan` | `/implement-plan PLAN_INPUT_PATH=docs/plans/example.md PLAN_APPROVED=true` |
| `/finalize-work` | `/finalize-work 总结本次已完成变更、验证结果、限制和后续事项` |

## Command Map

新用户和 consumer profile 默认优先使用五个主入口：`/explore`、`/produce-plan`、`/review`、`/implement-plan`、`/finalize-work`。当不确定下一步该选哪个入口时，先用只读 `/route`。其它命令保留为高级/兼容入口，不改变既有行为。

| 阶段 | 目标 | 主入口 | 高级/兼容入口 |
| --- | --- | --- | --- |
| Explore | 选择入口、理解问题、收集事实、暴露不确定性 | `/route`, `/explore` | `/senior-explore`, `/explore-lite`, `/explore-review` |
| Plan | 输出实现方案或设计文档 | `/produce-plan` | `/plan-lite`, `/plan-review`, `/backend-plan` |
| Review | 审查代码、计划或分支风险 | `/review` | `/review-lite`, `/review-only`, `/review-strict`, `/codex-review-only`, `/codex-verify-only` |
| Implement | 按计划实施 | `/implement-plan` | `/implement-standard`, `/implement-lite`, `/codex-review-fix` |
| Finalize | 交付总结、风险、验证与后续事项 | `/finalize-work` | `/finalize-lite` |

常用路径：

```text
/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
```

Codex 闭环路径：

```text
/codex-review-only -> 修复 -> /codex-verify-only
```

或使用半自动闭环：

```text
/codex-review-fix
```

Codex 命令是高级路径，需要本机可调用 Codex CLI，并需要 Bash 执行随 skill 分发的脚本。普通五阶段 workflow 不需要 Codex CLI。

## Core Agents + Packs

`nova-plugin` 的 agent 体系由 6 个短小、route-focused 的 core agents 承担通用职责，再通过 8 个 capability packs 补充领域规则。Packs 是第一阶段的文档化能力包，不做复杂运行时动态加载；已安装插件只作为 enhanced mode，缺失时必须可通过 fallback mode 完成任务。

| Core agent | 职责 |
| --- | --- |
| `orchestrator` | 拆解任务、选择 agent + pack、合并结果、发现缺失输入 |
| `architect` | 架构方案、边界、风险、迁移计划、技术决策 |
| `builder` | 实现、重构、集成、按计划修改项目文件 |
| `reviewer` | 代码、设计、安全、质量审查，输出优先级发现 |
| `verifier` | 测试、静态检查、依赖安全、CI/local validation |
| `publisher` | README、docs、CHANGELOG、release notes、handoff |

Capability packs: `java`, `security`, `dependency`, `docs`, `release`, `marketplace`, `frontend`, `mcp`。

## Five-Layer Architecture

`nova-plugin` 可以按五层维护：规则记忆、skill 行为契约、确定性护栏、core-agent 委派和 marketplace 分发。完整说明见 [Agent Development Stack](./nova-plugin/docs/architecture/agent-development-stack.md)。

| 层 | 当前事实源 | 维护重点 |
| --- | --- | --- |
| Memory | `CLAUDE.md`、`AGENTS.md`、`docs/consumers/` | Claude 规范事实源、非 Claude agent 适配、consumer profile 边界、公开/私有信息分离 |
| Skills | `nova-plugin/skills/`、`nova-plugin/commands/` | command / skill 一对一、参数、安全边界和输出契约 |
| Guardrails | `nova-plugin/hooks/`、`scripts/validate-*.mjs` | 确定性 hook、schema、frontmatter、docs 和发布校验 |
| Delegation | `nova-plugin/agents/`、`nova-plugin/packs/` | 6 个 core agents、8 个 capability packs、enhanced / fallback 路由 |
| Distribution | `.claude-plugin/`、`nova-plugin/.claude-plugin/plugin.json` | marketplace metadata、生成 catalog、安装分发边界 |

## What Is Included

```text
llm-plugins-fusion/
|-- .claude-plugin/
|   |-- registry.source.json          # registry 生成输入
|   |-- marketplace.json              # 生成的 Claude marketplace 入口
|   `-- marketplace.metadata.json     # 生成的仓库本地 trust/risk/maintainer/evidence 元数据
|-- nova-plugin/
|   |-- .claude-plugin/plugin.json    # 插件元信息，版本事实源
|   |-- commands/                     # 21 个 slash command 薄入口
|   |-- skills/                       # 21 个 nova-* skills + _shared 策略
|   |-- agents/                       # 6 个 core active agents
|   |-- packs/                        # 8 个 capability pack 文档
|   |-- docs/                         # 用户文档、命令文档和当前架构说明
|   `-- hooks/                        # Claude Code hook 配置和脚本
|-- docs/
|   |-- README.md                     # 仓库级文档总索引
|   |-- agents/                       # core agent 路由、plugin-aware routing 与迁移清单
|   |-- consumers/                    # consumer profile 契约与脱敏接入模板
|   |-- examples/                     # 脱敏 Java backend / frontend 示例
|   |-- marketplace/                  # catalog、作者流程、兼容矩阵、trust 与安全评审策略
|   |-- prompts/                      # 可复制的公开安全 prompt 模板
|   |-- releases/                     # release 决策、runbook 与 hygiene 说明
|   |-- workflows/                    # 上下文安全 agent workflow 指南
|   `-- project-optimization-plan.md   # 当前项目优化方案
|-- fixtures/                         # registry 多 entry fixture
|-- schemas/                          # registry source / marketplace / metadata / plugin schemas
|-- scripts/                          # 本地和 CI 校验脚本
|-- README.md
|-- AGENTS.md
|-- CLAUDE.md
|-- CODE_OF_CONDUCT.md
|-- CONTRIBUTING.md
|-- CHANGELOG.md
|-- ROADMAP.md
`-- SECURITY.md
```

## Documentation

| 文档 | 内容 | 适用场景 |
| --- | --- | --- |
| [仓库文档总索引](./docs/README.md) | `docs/` 目录结构、文档清单和维护规则 | 查找公开仓库文档 |
| [Getting Started](./docs/getting-started.md) | 安装、`/route`、五主命令、Codex 前置条件和常见失败处理 | 新用户最短路径 |
| [nova-plugin 文档索引](./nova-plugin/docs/README.md) | 文档结构、命令文档覆盖、维护规则 | 先找入口 |
| [CLAUDE.md](./CLAUDE.md) | Claude Code 的仓库级规范和共享事实源 | Claude Code 在本仓库工作前读取 |
| [AGENTS.md](./AGENTS.md) | Codex 和通用 AI coding agent 的轻量适配规则 | 非 Claude agent 在本仓库工作前读取 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | PR、marketplace entry、命令/skill 维护规则 | 准备贡献或改结构 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本历史和 unreleased 变更 | 查版本影响 |
| [ROADMAP.md](./ROADMAP.md) | 当前路线图、非目标和维护规则 | 规划后续工作 |
| [SECURITY.md](./SECURITY.md) | 支持范围、漏洞报告和披露策略 | 安全问题处理 |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | 贡献者行为准则 | 社区协作规范 |
| [Consumer profile templates](./docs/consumers/README.md) | 多项目 consumer profile 契约、Java backend / frontend 脱敏模板 | 闭源或私有项目接入 |
| [Cursor setup](./docs/consumers/cursor-setup.md) | 在 Cursor rules 中消费 `nova-route` 和核心 nova skills | 非 Claude Code 工具接入 |
| [Gemini CLI setup](./docs/consumers/gemini-cli-setup.md) | 在 Gemini CLI 上下文或 skills 中消费 nova workflows | 非 Claude Code 工具接入 |
| [OpenCode setup](./docs/consumers/opencode-setup.md) | OpenCode intent-to-skill 路由和 fallback 说明 | 非 Claude Code 工具接入 |
| [Copilot setup](./docs/consumers/copilot-setup.md) | GitHub Copilot instructions 与 core-agent 映射 | 非 Claude Code 工具接入 |
| [Codex setup](./docs/consumers/codex-setup.md) | Codex 消费 Markdown skills 与 Codex loop 前置条件 | Codex / 其它 agent 接入 |
| [Workbench consumer template](./docs/consumers/workbench-template.md) | 私有工作区目录、命名、checkpoint 和 handoff 规则 | 长任务过程资产沉淀 |
| [Redacted examples](./docs/examples/README.md) | 脱敏 Java backend 和 frontend workflow 示例 | 编写私有 profile 或 handoff 模板 |
| [Workflow evaluation examples](./docs/examples/workflow-evaluation.md) | 五阶段 workflow 的公开安全样例、rubric 和失败信号 | 验证命令输出质量 |
| [Context-safe workflows](./docs/workflows/context-safe-agent-workflows.md) | 防上下文膨胀的 review、fix、文档和交付闭环 | 大任务拆分与断点续跑 |
| [Thin harness, fat skills doctrine](./docs/workflows/thin-harness-fat-skills.md) | 判定脚本、skill、prompt、pack 和 consumer profile 的沉淀边界 | 把重复 agent 工作流转成项目资产 |
| [Prompt template library](./docs/prompts/README.md) | Codex、Claude Code 和通用交付文档 prompt 模板 | 复制到私有 consumer 项目后定制 |
| [命令完全参考手册](./nova-plugin/docs/guides/commands-reference-guide.md) | 参数、示例、工作流模板 | 日常查命令 |
| [命令使用手册](./nova-plugin/docs/guides/claude-code-commands-handbook.md) | 命令选择、使用方式、复制模板 | 快速上手 |
| [Codex 闭环说明](./nova-plugin/docs/commands/codex/codex-review-fix.README.md) | review / fix / verify 协作流程 | Claude Code + Codex |
| [Skill-first 设计](./nova-plugin/docs/architecture/dual-track-design.md) | command 与 skill 的职责边界 | 修改命令或 skill |
| [Hooks 设计](./nova-plugin/docs/architecture/hooks-design.md) | 写入前检查和审计日志 hook | 维护安全边界 |
| [Agent Development Stack](./nova-plugin/docs/architecture/agent-development-stack.md) | 五层架构、事实源和质量门映射 | 理解或维护整体插件栈 |
| [Core agent 路由](./docs/agents/ROUTING.md) | 6 个 core agents 与 capability packs 的路由规则 | 选择或维护 agent |
| [Plugin-aware routing](./docs/agents/PLUGIN_AWARE_ROUTING.md) | enhanced / fallback mode 与 pack 启用规则 | 维护 pack 路由 |
| [项目优化方案](./docs/project-optimization-plan.md) | 当前项目定位、可靠性、易用性、维护性和发布推广优化计划 | 规划后续优化 |
| [Marketplace catalog](./docs/marketplace/catalog.md) | 由 registry 生成的当前插件 catalog 与兼容证据 | 浏览 marketplace entry |
| [Marketplace portal IA](./docs/marketplace/portal-information-architecture.md) | 市场门面信息架构、数据源、当前 `v2.2.0` 单插件边界和 deferred `v3.0.0` 边界 | 评估 deferred portal 边界 |
| [v3 readiness evidence](./docs/marketplace/v3-readiness-evidence.md) | 多插件目录和 public portal 是否应启动的证据台账 | 评估 v3.0.0 是否可进入计划 |
| [Registry author workflow](./docs/marketplace/registry-author-workflow.md) | 新增插件 entry、scaffold dry-run、profile 与校验流程 | 插件作者与维护者 |
| [Compatibility matrix](./docs/marketplace/compatibility-matrix.md) | Claude Code、Codex CLI、Bash、Node.js 与 enhanced tools 前置条件 | 评审兼容性 |
| [Trust policy](./docs/marketplace/trust-policy.md) | trust/risk/deprecation/last-updated/maintainer 语义与评审要求 | 评审 marketplace metadata |
| [Security review route](./docs/marketplace/security-review-route.md) | 安全敏感插件变更的评审路径和最小检查 | 安全评审 |
| [Release hygiene](./docs/releases/release-hygiene.md) | tag/version 同步、生成产物漂移、changelog 与发布前 review | 发布准备 |
| [Release evidence template](./docs/releases/release-evidence-template.md) | release/promotion 前的环境、tag、校验和 skipped 记录模板 | 发布证据留档 |
| [Capability packs](./nova-plugin/packs/README.md) | 8 个领域能力包索引 | 维护 packs |
| [English overview](./nova-plugin/docs/overview/README.en.md) | English project overview | English readers |

## Maintenance

版本与 registry 事实源：

- `nova-plugin/.claude-plugin/plugin.json`：插件元信息与版本事实源
- `.claude-plugin/registry.source.json`：registry、marketplace 展示字段和 trust/risk/maintainer/evidence 元数据事实源
- `.claude-plugin/marketplace.json`：生成的 Claude marketplace manifest
- `.claude-plugin/marketplace.metadata.json`：生成的仓库本地 metadata
- `docs/marketplace/catalog.md`：由 registry 生成的 Markdown catalog
- `CHANGELOG.md`
- `package.json`：维护者便捷脚本（`validate`、`validate:docs`、
  `validate:schemas`、`validate:runtime`、`validate:regression`、
  `scan:distribution`、`scaffold:consumer`）；不声明 `check` / `lint` /
  `test` / `build` 脚本名，避免被 `run-project-checks.sh` 的 package script
  discovery 重复执行

Command 与 skill 必须一对一：

```text
nova-plugin/commands/<id>.md
nova-plugin/skills/nova-<id>/SKILL.md
```

每个命令必须有三份命令文档：

```text
nova-plugin/docs/commands/<stage>/<id>.md
nova-plugin/docs/commands/<stage>/<id>.README.md
nova-plugin/docs/commands/<stage>/<id>.README.en.md
```

Codex 命令集中放在 `nova-plugin/docs/commands/codex/`，这是命令文档按 stage 目录组织规则的明确例外。

## Quality Gates

全量检查：

```bash
node scripts/validate-all.mjs
```

按变更范围运行：

```bash
node scripts/generate-registry.mjs
node scripts/validate-schemas.mjs
node scripts/validate-registry-fixtures.mjs
node scripts/validate-claude-compat.mjs
node scripts/validate-plugin-install.mjs
node scripts/lint-frontmatter.mjs
node scripts/validate-packs.mjs
node scripts/validate-hooks.mjs
node scripts/validate-runtime-smoke.mjs
node scripts/scan-distribution-risk.mjs
node scripts/validate-regression.mjs
node scripts/validate-docs.mjs
```

如果使用 npm 入口，默认总入口等价于仓库全量校验：

```bash
npm run validate
```

Agent 检查：

```bash
bash scripts/verify-agents.sh
```

Windows PowerShell：

```powershell
.\scripts\verify-agents.ps1
```

Pack 检查：

```bash
node scripts/validate-packs.mjs
```

Hook shell 语法检查需要 Bash：

```bash
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

Claude 插件安装 smoke test 需要 Claude CLI，且会尝试安装 user-scope 插件：

```bash
node scripts/validate-plugin-install.mjs
```

## Contributing

提交 PR 前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。安全问题请按 [SECURITY.md](./SECURITY.md) 私下披露。项目路线见 [ROADMAP.md](./ROADMAP.md)。

## License

本项目使用 [MIT License](./LICENSE)。

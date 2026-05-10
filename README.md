中文 | [English](nova-plugin/docs/overview/README.en.md)

<div align="center">

# LLM Plugins Fusion

**公开的多项目 AI 工程工作流框架，提供 `nova-plugin` 工作流、consumer profile 契约和脱敏模板**

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/lliangcol/llm-plugins-fusion)
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
| 插件用户 | 安装 `nova-plugin`、选择命令、复制使用模板 | [Quick Start](#quick-start)、[Command Map](#command-map)、[文档索引](./nova-plugin/docs/README.md) |
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
<td>2.1.0</td>
</tr>
<tr>
<td><strong>主插件</strong></td>
<td><code>nova-plugin</code></td>
</tr>
<tr>
<td><strong>命令 / Skills</strong></td>
<td>20 个命令，20 个一对一 skills</td>
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

仓库当前的自动化质量门覆盖 schema、registry fixture、Claude 兼容性、command / skill frontmatter、core agent 集合、capability pack 结构、hooks 配置、Markdown 本地链接、命令文档覆盖与生成 catalog 漂移。完整检查入口是：

```bash
node scripts/validate-all.mjs
```

Windows PowerShell 可以运行 Node 校验和 `scripts/verify-agents.ps1`。如果本机没有 Bash，`validate-all` 会 warning 跳过本地 `bash -n` hook 语法检查；CI/Linux 仍会执行并要求通过。

## 稳定发布与推广口径

当前稳定推广对象是正式 release tag，例如 `v2.1.0`。当前 `main` 可能包含 `CHANGELOG.md` `Unreleased` 下的后续文档或优化工作，不能描述为稳定版本，也不能替代 release tag 做安装、推广或发布证据。

发布或推广前必须使用 [release evidence template](./docs/releases/release-evidence-template.md) 记录目标 commit、exact tag、`node scripts/validate-all.mjs`、`git diff --check`、Bash hook syntax 检查和 skipped checks。Windows 本地如果因为没有 Bash 得到 `failed=0 skipped=1`，只能描述为“本地结构校验通过但 hook shell syntax 未本地执行”，需要 CI/Linux 的 `bash -n` 结果作为补充证据。

## Quick Start

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

新用户和 consumer profile 默认优先使用五个主入口：`/explore`、`/produce-plan`、`/review`、`/implement-plan`、`/finalize-work`。其它命令保留为高级/兼容入口，不改变既有行为。

| 阶段 | 目标 | 主入口 | 高级/兼容入口 |
| --- | --- | --- | --- |
| Explore | 理解问题、收集事实、暴露不确定性 | `/explore` | `/senior-explore`, `/explore-lite`, `/explore-review` |
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

## What Is Included

```text
llm-plugins-fusion/
|-- .claude-plugin/
|   |-- registry.source.json          # registry 生成输入
|   |-- marketplace.json              # 生成的 Claude marketplace 入口
|   `-- marketplace.metadata.json     # 生成的仓库本地 trust/risk/maintainer/evidence 元数据
|-- nova-plugin/
|   |-- .claude-plugin/plugin.json    # 插件元信息，版本事实源
|   |-- commands/                     # 20 个 slash command 薄入口
|   |-- skills/                       # 20 个 nova-* skills + _shared 策略
|   |-- agents/                       # 6 个 core active agents
|   |-- packs/                        # 8 个 capability pack 文档
|   |-- docs/                         # 用户文档、命令文档、架构和历史记录
|   `-- hooks/                        # Claude Code hook 配置和脚本
|-- docs/
|   |-- agents/                       # core agent 路由、plugin-aware routing 与迁移清单
|   |-- consumers/                    # consumer profile 契约与脱敏接入模板
|   |-- examples/                     # 脱敏 Java backend / frontend 示例
|   |-- marketplace/                  # catalog、作者流程、兼容矩阵、trust 与安全评审策略
|   |-- releases/                     # release 决策、runbook 与 hygiene 说明
|   |-- project-optimization-plan.md   # 当前项目优化方案
|   `-- reports/                      # 优化报告与历史审计归档
|-- fixtures/                         # registry 多 entry fixture
|-- schemas/                          # registry source / marketplace / metadata / plugin schemas
|-- scripts/                          # 本地和 CI 校验脚本
|-- README.md
|-- CONTRIBUTING.md
|-- CHANGELOG.md
|-- ROADMAP.md
`-- SECURITY.md
```

## Documentation

| 文档 | 内容 | 适用场景 |
| --- | --- | --- |
| [nova-plugin 文档索引](./nova-plugin/docs/README.md) | 文档结构、命令文档覆盖、维护规则 | 先找入口 |
| [Consumer profile templates](./docs/consumers/README.md) | 多项目 consumer profile 契约、Java backend / frontend 脱敏模板 | 闭源或私有项目接入 |
| [Redacted examples](./docs/examples/README.md) | 脱敏 Java backend 和 frontend workflow 示例 | 编写私有 profile 或 handoff 模板 |
| [Workflow evaluation examples](./docs/examples/workflow-evaluation.md) | 五阶段 workflow 的公开安全样例、rubric 和失败信号 | 验证命令输出质量 |
| [命令完全参考手册](./nova-plugin/docs/guides/commands-reference-guide.md) | 参数、示例、工作流模板 | 日常查命令 |
| [命令使用手册](./nova-plugin/docs/guides/claude-code-commands-handbook.md) | 命令选择、使用方式、复制模板 | 快速上手 |
| [Codex 闭环说明](./nova-plugin/docs/commands/codex/codex-review-fix.README.md) | review / fix / verify 协作流程 | Claude Code + Codex |
| [Skill-first 设计](./nova-plugin/docs/architecture/dual-track-design.md) | command 与 skill 的职责边界 | 修改命令或 skill |
| [Hooks 设计](./nova-plugin/docs/architecture/hooks-design.md) | 写入前检查和审计日志 hook | 维护安全边界 |
| [Core agent 路由](./docs/agents/ROUTING.md) | 6 个 core agents 与 capability packs 的路由规则 | 选择或维护 agent |
| [Plugin-aware routing](./docs/agents/PLUGIN_AWARE_ROUTING.md) | enhanced / fallback mode 与 pack 启用规则 | 维护 pack 路由 |
| [项目优化方案](./docs/project-optimization-plan.md) | 当前项目定位、可靠性、易用性、维护性和发布推广优化计划 | 规划后续优化 |
| [Marketplace catalog](./docs/marketplace/catalog.md) | 由 registry 生成的当前插件 catalog 与兼容证据 | 浏览 marketplace entry |
| [Marketplace portal IA](./docs/marketplace/portal-information-architecture.md) | 市场门面信息架构、数据源和 vNext / v2.0.0 / v2.1.0 / v2.2.0 / v3.0.0 边界 | 评估 deferred portal 边界 |
| [v3 readiness evidence](./docs/marketplace/v3-readiness-evidence.md) | 多插件目录和 public portal 是否应启动的证据台账 | 评估 v3.0.0 是否可进入计划 |
| [Registry author workflow](./docs/marketplace/registry-author-workflow.md) | 新增插件 entry、scaffold dry-run、profile 与校验流程 | 插件作者与维护者 |
| [Compatibility matrix](./docs/marketplace/compatibility-matrix.md) | Claude Code、Codex CLI、Bash、Node.js 与 enhanced tools 前置条件 | 评审兼容性 |
| [Trust policy](./docs/marketplace/trust-policy.md) | trust/risk/deprecation/last-updated/maintainer 语义与评审要求 | 评审 marketplace metadata |
| [Security review route](./docs/marketplace/security-review-route.md) | 安全敏感插件变更的评审路径和最小检查 | 安全评审 |
| [Release hygiene](./docs/releases/release-hygiene.md) | tag/version 同步、生成产物漂移、changelog 与发布前 review | 发布准备 |
| [Release evidence template](./docs/releases/release-evidence-template.md) | release/promotion 前的环境、tag、校验和 skipped 记录模板 | 发布证据留档 |
| [vNext release decision](./docs/releases/vnext-release-decision.md) | vNext 版本级别与兼容性矩阵 | 发布决策 |
| [v2.0.0 manual release steps](./docs/releases/v2.0.0-manual-release-steps.md) | 人工发布、打 tag、GitHub Release 校验与失败处理步骤 | 发布执行 |
| [Capability packs](./nova-plugin/packs/README.md) | 8 个领域能力包索引 | 维护 packs |
| [Legacy agents 汇总](./nova-plugin/docs/agents/agents-summary.md) | 已归档 legacy agents 的历史角色说明 | 查阅旧版设计 |
| [English overview](./nova-plugin/docs/overview/README.en.md) | English project overview | English readers |

## Maintenance

版本与 registry 事实源：

- `nova-plugin/.claude-plugin/plugin.json`：插件元信息与版本事实源
- `.claude-plugin/registry.source.json`：registry、marketplace 展示字段和 trust/risk/maintainer/evidence 元数据事实源
- `.claude-plugin/marketplace.json`：生成的 Claude marketplace manifest
- `.claude-plugin/marketplace.metadata.json`：生成的仓库本地 metadata
- `docs/marketplace/catalog.md`：由 registry 生成的 Markdown catalog
- `CHANGELOG.md`

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
node scripts/lint-frontmatter.mjs
node scripts/validate-packs.mjs
node scripts/validate-hooks.mjs
node scripts/validate-docs.mjs
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

## Contributing

提交 PR 前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。安全问题请按 [SECURITY.md](./SECURITY.md) 私下披露。项目路线见 [ROADMAP.md](./ROADMAP.md)。

## License

本项目使用 [MIT License](./LICENSE)。

中文 | [English](nova-plugin/docs/overview/README.en.md)

<div align="center">

# LLM Plugins Fusion

**第三方 LLM 编码助手插件市场与 `nova-plugin` 工程工作流插件集合**

[![Version](https://img.shields.io/badge/version-1.0.9-blue.svg)](https://github.com/lliangcol/llm-plugins-fusion)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

</div>

---

## 项目定位

`llm-plugins-fusion` 是一个面向 LLM 编码助手的第三方插件市场仓库。目前主插件是 `nova-plugin`，兼容 Claude Code 插件市场，提供从理解问题到交付总结的工程化命令体系：

```text
Explore -> Plan -> Review -> Implement -> Finalize
```

它适合三类使用者：

| 使用者 | 关注点 | 推荐入口 |
| --- | --- | --- |
| 插件用户 | 安装插件、选择命令、复制使用模板 | [Quick Start](#quick-start)、[Command Map](#command-map)、[文档索引](./nova-plugin/docs/README.md) |
| 插件作者 | 新增 command / skill、理解 frontmatter 契约 | [CONTRIBUTING.md](./CONTRIBUTING.md)、[Skill-first 设计](./nova-plugin/docs/architecture/dual-track-design.md) |
| 维护者 | schema、CI、本地校验、发布与安全边界 | [Quality Gates](#quality-gates)、[SECURITY.md](./SECURITY.md)、[CHANGELOG.md](./CHANGELOG.md) |

## 当前状态

<table>
<tr>
<td><strong>插件版本</strong></td>
<td>1.0.9</td>
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

仓库当前的自动化质量门覆盖 schema、Claude 兼容性、command / skill frontmatter、core agent 集合、capability pack 结构、hooks 配置、Markdown 本地链接与命令文档覆盖。完整检查入口是：

```bash
node scripts/validate-all.mjs
```

Windows PowerShell 可以运行 Node 校验和 `scripts/verify-agents.ps1`。如果本机没有 Bash，`validate-all` 会 warning 跳过本地 `bash -n` hook 语法检查；CI/Linux 仍会执行并要求通过。

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
/senior-explore 分析当前项目结构和主要风险
```

## Command Map

新用户优先使用统一入口：`/explore`、`/produce-plan`、`/review`、`/implement-plan`、`/finalize-work`。需要更强自动化复核时，再使用 Codex 三件套。

| 阶段 | 目标 | 推荐命令 | 其他命令 |
| --- | --- | --- | --- |
| Explore | 理解问题、收集事实、暴露不确定性 | `/explore`, `/senior-explore` | `/explore-lite`, `/explore-review` |
| Plan | 输出实现方案或设计文档 | `/produce-plan` | `/plan-lite`, `/plan-review`, `/backend-plan` |
| Review | 审查代码、计划或分支风险 | `/review` | `/review-lite`, `/review-only`, `/review-strict`, `/codex-review-only`, `/codex-verify-only` |
| Implement | 按计划实施或执行闭环修复 | `/implement-plan`, `/codex-review-fix` | `/implement-standard`, `/implement-lite` |
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
|   `-- marketplace.metadata.json     # 生成的仓库本地 trust/risk/date 元数据
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
|   |-- marketplace/                  # 市场门面信息架构准备
|   |-- releases/                     # release 决策与兼容性说明
|   `-- reports/archive/              # 历史审计报告
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
| [命令完全参考手册](./nova-plugin/docs/guides/commands-reference-guide.md) | 参数、示例、工作流模板 | 日常查命令 |
| [命令使用手册](./nova-plugin/docs/guides/claude-code-commands-handbook.md) | 命令选择、使用方式、复制模板 | 快速上手 |
| [Codex 闭环说明](./nova-plugin/docs/commands/codex/codex-review-fix.README.md) | review / fix / verify 协作流程 | Claude Code + Codex |
| [Skill-first 设计](./nova-plugin/docs/architecture/dual-track-design.md) | command 与 skill 的职责边界 | 修改命令或 skill |
| [Hooks 设计](./nova-plugin/docs/architecture/hooks-design.md) | 写入前检查和审计日志 hook | 维护安全边界 |
| [Core agent 路由](./docs/agents/ROUTING.md) | 6 个 core agents 与 capability packs 的路由规则 | 选择或维护 agent |
| [Plugin-aware routing](./docs/agents/PLUGIN_AWARE_ROUTING.md) | enhanced / fallback mode 与 pack 启用规则 | 维护 pack 路由 |
| [Marketplace portal IA](./docs/marketplace/portal-information-architecture.md) | 市场门面信息架构、数据源和 vNext / v2.0.0 / v2.1.0 / v3.0.0 边界 | 准备 marketplace portal |
| [vNext release decision](./docs/releases/vnext-release-decision.md) | vNext 版本级别与兼容性矩阵 | 发布决策 |
| [Capability packs](./nova-plugin/packs/README.md) | 8 个领域能力包索引 | 维护 packs |
| [Legacy agents 汇总](./nova-plugin/docs/agents/agents-summary.md) | 已归档 legacy agents 的历史角色说明 | 查阅旧版设计 |
| [English overview](./nova-plugin/docs/overview/README.en.md) | English project overview | English readers |

## Maintenance

版本与 registry 事实源：

- `nova-plugin/.claude-plugin/plugin.json`：插件元信息与版本事实源
- `.claude-plugin/registry.source.json`：registry、marketplace 展示字段和 trust/risk/date 元数据事实源
- `.claude-plugin/marketplace.json`：生成的 Claude marketplace manifest
- `.claude-plugin/marketplace.metadata.json`：生成的仓库本地 metadata
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

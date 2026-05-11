中文 | [English](nova-plugin/docs/overview/README.en.md)

<div align="center">

# LLM Plugins Fusion

**公开的多项目 AI 工程工作流框架，提供 `nova-plugin` 工作流、consumer profile 契约和脱敏模板**

[![Version](https://img.shields.io/badge/version-2.2.0-blue.svg)](https://github.com/lliangcol/llm-plugins-fusion)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

</div>

---

## 项目定位

`llm-plugins-fusion` 是一个面向 LLM coding assistant 的公开多项目工程工作流框架。当前主交付物是 `nova-plugin`，通过 Claude Code marketplace 安装和分发，围绕以下工程节奏组织命令、skills、agent 路由和验证边界：

```text
Explore -> Plan -> Review -> Implement -> Finalize
```

公开仓库只沉淀通用 workflow、consumer profile 契约、脱敏模板、prompt 模板和 capability pack 指南。真实 consumer profile、endpoint、凭据、私有知识库和业务规则应保存在 consumer 项目自己的 `AGENTS.md`、`CLAUDE.md`、`.claude/` 或私有文档中。

当前 marketplace 是安装与分发机制；本仓库不把当前状态描述为成熟多插件生态，也不把 deferred public portal 当作已实现能力。

## 快速导航

| 角色 | 先读 | 下一步 |
| --- | --- | --- |
| 插件用户 | [Getting Started](./docs/getting-started.md) | 安装 `nova-plugin`，从 [Quick Start](#quick-start) 或 [Command Map](#command-map) 选择命令。 |
| Consumer 项目维护者 | [Consumer profiles](./docs/consumers/README.md) | 在私有项目维护 profile，再按 profile 选择 workflow 和校验边界。 |
| 插件作者 | [CONTRIBUTING.md](./CONTRIBUTING.md) | 修改 command / skill 前确认 [Skill-first 设计](./nova-plugin/docs/architecture/dual-track-design.md)。 |
| 维护者 | [Quality Gates](#quality-gates) | 按变更范围运行校验，并参考 [release evidence template](./docs/releases/release-evidence-template.md)。 |

适合使用：

- 已经使用 Claude Code，希望用固定的 explore / plan / review / implement / finalize 节奏管理 AI 编码工作。
- 维护多个 consumer 项目，需要把通用 workflow 留在公开仓库，把真实项目 profile 留在私有项目。
- 希望通过 schema、frontmatter、文档覆盖、分发风险扫描和 release hygiene 降低插件维护漂移。

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

当前默认质量门覆盖 schema、registry fixture、Claude 兼容性、command / skill frontmatter、core agent 集合、capability pack 结构、hooks 配置、Codex Bash runtime smoke、分发风险扫描、核心回归检查、Markdown 链接、命令文档覆盖和生成 catalog 漂移。默认本地入口是：

```bash
node scripts/validate-all.mjs
```

Windows PowerShell 可以运行 Node 校验和 `scripts/verify-agents.ps1`。如果本机没有 Bash，`validate-all` 会 warning 跳过 Bash-dependent hook syntax 与 runtime smoke 检查；这些只能报告为 skipped，不能报告为 passed，CI/Linux 仍需执行。

## 稳定发布与推广口径

稳定推广对象是正式 release tag，例如 `v2.2.0`。`main` 可能包含 `CHANGELOG.md` `Unreleased` 下的后续文档或优化工作，不能替代 release tag 作为安装、推广或发布证据。

发布或推广前使用 [release evidence template](./docs/releases/release-evidence-template.md) 记录目标 commit、exact tag、`node scripts/validate-all.mjs`、`git diff --check`、Bash hook syntax、Codex runtime smoke、分发风险扫描和 skipped checks。

## Quick Start

最短上手路径见 [docs/getting-started.md](./docs/getting-started.md)。普通 `nova-plugin` workflow 只需要 Claude Code 插件；维护仓库或运行本地校验需要 Node.js 20+；Codex 闭环命令额外需要本机 Codex CLI 和 Bash。
`nova-plugin` 不建议用全局权限绕过作为默认运行方式；写入、Bash 和外部
CLI 流程应通过明确参数、preflight、artifact 范围和验证证据来约束。

在 Claude Code 中添加 marketplace 并安装插件：

```text
/plugin marketplace add lliangcol/llm-plugins-fusion
/plugin install nova-plugin@llm-plugins-fusion
```

确认插件可用：

```text
/plugin
```

从只读路由开始：

```text
/route 这项任务涉及文档、版本和安装验证，请推荐下一步 nova workflow
```

或直接进入默认五阶段 workflow：

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

## Command Map

新用户和 consumer profile 默认优先使用五个主入口：`/explore`、`/produce-plan`、`/review`、`/implement-plan`、`/finalize-work`。不确定下一步时先用只读 `/route`。其它命令保留为高级/兼容入口，不改变既有行为。

| 阶段 | 目标 | 主入口 | 高级/兼容入口 |
| --- | --- | --- | --- |
| Explore | 选择入口、理解问题、收集事实、暴露不确定性 | `/route`, `/explore` | `/senior-explore`, `/explore-lite`, `/explore-review` |
| Plan | 输出实现方案或设计文档 | `/produce-plan` | `/plan-lite`, `/plan-review`, `/backend-plan` |
| Review | 审查代码、计划或分支风险 | `/review` | `/review-lite`, `/review-only`, `/review-strict`, `/codex-review-only`, `/codex-verify-only` |
| Implement | 按计划实施 | `/implement-plan` | `/implement-standard`, `/implement-lite`, `/codex-review-fix` |
| Finalize | 交付总结、风险、验证与后续事项 | `/finalize-work` | `/finalize-lite` |

Codex 闭环是高级路径，需要 Codex CLI 和 Bash：

```text
/codex-review-only -> 修复 -> /codex-verify-only
```

也可以使用半自动闭环：

```text
/codex-review-fix
```

## Core Agents + Packs

`nova-plugin` 的 agent 体系由 6 个短小、route-focused 的 core agents 承担通用职责，再通过 8 个 capability packs 补充领域规则。Packs 是文档化能力包，不做复杂运行时动态加载；已安装插件只作为 enhanced mode，缺失时必须可通过 fallback mode 完成任务。

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
|-- docs/                             # 仓库文档、consumer 契约、示例、prompt、release 与 marketplace 指南
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

根 README 只保留入口级导航；完整清单由 [docs/README.md](./docs/README.md) 和 [nova-plugin/docs/README.md](./nova-plugin/docs/README.md) 维护。

| 需要 | 入口 |
| --- | --- |
| 快速安装和开始使用 | [Getting Started](./docs/getting-started.md) |
| 查看所有仓库级公开文档 | [仓库文档总索引](./docs/README.md) |
| 查看插件文档、命令文档和架构说明 | [nova-plugin 文档索引](./nova-plugin/docs/README.md) |
| 查命令参数、示例和 workflow 模板 | [命令完全参考手册](./nova-plugin/docs/guides/commands-reference-guide.md) |
| 复制命令选择和使用模板 | [命令使用手册](./nova-plugin/docs/guides/claude-code-commands-handbook.md) |
| 接入私有 consumer 项目 | [Consumer profile templates](./docs/consumers/README.md) |
| 复用公开安全 workflow 示例 | [Redacted examples](./docs/examples/README.md) |
| 维护 marketplace metadata | [Registry author workflow](./docs/marketplace/registry-author-workflow.md) |
| 准备发布证据 | [Release evidence template](./docs/releases/release-evidence-template.md) |
| 了解 agent routing 和 capability packs | [Core agent 路由](./docs/agents/ROUTING.md)、[Capability packs](./nova-plugin/packs/README.md) |
| 阅读英文概览 | [English overview](./nova-plugin/docs/overview/README.en.md) |

## Maintenance

版本与 registry 事实源：

- `nova-plugin/.claude-plugin/plugin.json`：插件元信息与版本事实源
- `.claude-plugin/registry.source.json`：registry、marketplace 展示字段和 trust/risk/maintainer/evidence 元数据事实源
- `.claude-plugin/marketplace.json`、`.claude-plugin/marketplace.metadata.json`、`docs/marketplace/catalog.md`：生成输出，不要手工编辑
- `CHANGELOG.md`、`SECURITY.md`、`CLAUDE.md`、`AGENTS.md`：版本、支持范围、库存或行为边界变化时同步
- `package.json`：维护者便捷脚本；刻意不声明 `check` / `lint` / `test` / `build` 脚本名

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

Generated marketplace files 必须从源文件更新：

```bash
node scripts/generate-registry.mjs --write
```

## Quality Gates

全量检查：

```bash
node scripts/validate-all.mjs
```

文档类改动的最小检查：

```bash
node scripts/validate-docs.mjs
git diff --check
```

维护者也可以使用不引入依赖的 npm 快捷入口：

```bash
npm run validate
npm run validate:docs
npm run validate:schemas
npm run validate:runtime
npm run validate:regression
npm run validate:surface
npm run scan:distribution
```

Consumer profile scaffold 需要参数：

```bash
npm run scaffold:consumer -- --type java-backend --out <dir>
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
node scripts/validate-runtime-smoke.mjs
node scripts/scan-distribution-risk.mjs
node scripts/validate-regression.mjs
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

Hook shell 语法检查需要 Bash：

```bash
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

Claude 插件安装 smoke test 需要 Claude CLI，且会尝试安装 user-scope 插件，因此不在默认本地检查中自动运行：

```bash
node scripts/validate-plugin-install.mjs
```

## Contributing

提交 PR 前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。安全问题请按 [SECURITY.md](./SECURITY.md) 私下披露。项目路线见 [ROADMAP.md](./ROADMAP.md)。

## License

本项目使用 [MIT License](./LICENSE)。

中文 | [English](nova-plugin/docs/overview/README.en.md)

<div align="center">

# LLM Plugins Fusion

**让 Claude Code 按 Explore -> Plan -> Review -> Implement -> Finalize 的工程节奏工作。**

[![CI](https://github.com/lliangcol/llm-plugins-fusion/actions/workflows/ci.yml/badge.svg)](https://github.com/lliangcol/llm-plugins-fusion/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/lliangcol/llm-plugins-fusion?label=release)](https://github.com/lliangcol/llm-plugins-fusion/releases/latest)
[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](https://github.com/lliangcol/llm-plugins-fusion/releases/tag/v4.0.0)
[![License](https://img.shields.io/github/license/lliangcol/llm-plugins-fusion)](./LICENSE)

</div>

---

## 30 秒看懂

`llm-plugins-fusion` 是面向 LLM coding assistant 的公开 AI 工程工作流框架。当前主交付物是 `nova-plugin`：一个可通过 Claude Code marketplace 安装的 workflow plugin，用命令、skills、core agents、capability packs 和验证脚本，把临时 prompt 收敛成可复用、可审查、可交付的工程流程。

跨 assistant 能力按证据分级：Claude Code 的 exact-tag 发布链路以 L4 为目标；没有当前 paired live evidence 时，Claude Code 与 Codex 都只声明 L2；通用 Agent Skills manifest 只声明 L1。能读取同一份 Markdown 不等于权限、安全或输出语义已经被验证，详见 [Assistant compatibility levels](./docs/compatibility/assistant-levels.md)。

```text
Explore -> Plan -> Review -> Implement -> Finalize
```

Marketplace metadata 只是当前安装与分发机制。本仓库不描述为成熟多插件生态，也不把 deferred public portal 当作已实现能力。公开内容只保存通用 workflow、consumer profile 契约、脱敏模板、prompt 模板和 capability pack 指南；真实 consumer profile、endpoint、凭据、私有知识库、业务规则和私有仓库地址应保存在 consumer 项目自己的 `AGENTS.md`、`CLAUDE.md`、`.claude/` 或私有文档中。

## 3 分钟安装

只读 `nova-plugin` workflow 只需要 Claude Code 插件。启用 Write/Edit guard 的写入流程需要 Node.js 22+ 与 Bash 3.2+（用于缺少 Node 时 fail closed）；仓库维护校验需要 Node.js 22+；Codex 闭环命令还需要 Bash 与本机 Codex CLI。

稳定安装入口以正式 release tag 为准。当前稳定推广基线是 `v4.0.0`；
`main` 可能包含 `CHANGELOG.md` `Unreleased` 下的后续优化，不能替代 exact
release tag 作为稳定发布证据。

```text
/plugin marketplace add lliangcol/llm-plugins-fusion@v4.0.0
/plugin install nova-plugin@llm-plugins-fusion
/nova-plugin:route 这项任务涉及文档、版本和安装验证，请推荐下一步 nova workflow
```

确认插件可用：

```text
/plugin
```

第一次安装后先运行只读 `/nova-plugin:route`。如需跟踪开发分支，显式添加 marketplace `lliangcol/llm-plugins-fusion@main`；不要把 `main` 当作 Stable。

没有 Claude Code 环境时，可以先用本地 headless demo 理解 workflow contract：

```bash
npm run demo:route
npm run demo:review
```

非 Claude 用户可以把 command / skill Markdown 当作可读契约消费；不要假设
Claude slash-command runtime 行为会在其它 coding assistant 中自动存在。

## 适用人群

| 你是 | 先读 | 目标 |
| --- | --- | --- |
| Claude Code 用户 | [Getting Started](./docs/getting-started.md) | 5 分钟内安装 `nova-plugin`，并用 `/nova-plugin:route` 完成第一次路由。 |
| 非 Claude 用户 | `npm run demo:route` / [Consumer setup](./docs/consumers/README.md) | 用 headless fixtures 和 Markdown contracts 理解 workflow，不假设 slash-command runtime。 |
| Consumer 项目维护者 | [Consumer profiles](./docs/consumers/README.md) | 在私有项目维护 profile，把公开仓库只当作通用 workflow 和模板来源。 |
| 插件作者 | [CONTRIBUTING.md](./CONTRIBUTING.md) | 修改 command / skill 前确认 [Skill-first 设计](./nova-plugin/docs/architecture/dual-track-design.md)。 |
| 首次贡献者 | [第一次贡献路径](./CONTRIBUTING.md#第一次贡献路径) | 从 docs clarification、fixture update、validator message 或 public-safe example 开始。 |
| 维护者 | [Quality Gates](#quality-gates) | 按变更范围运行校验，并用 [release evidence template](./docs/releases/release-evidence-template.md) 记录证据。 |

## Showcase

| 场景 | 入口 | 你会看到 |
| --- | --- | --- |
| Java backend | [docs/showcase/java-backend.md](./docs/showcase/java-backend.md) | 从模糊后端需求进入 explore、plan、review、implement、finalize 的证据链。 |
| Frontend | [docs/showcase/frontend.md](./docs/showcase/frontend.md) | 把 UI 需求转成组件、状态、可访问性和截图验证边界。 |
| Release and docs | [docs/showcase/release-and-docs.md](./docs/showcase/release-and-docs.md) | 用 nova workflow 处理发布说明、文档同步、验证证据和残余风险。 |

更多视觉资产与录屏脚本见 [docs/assets/README.md](./docs/assets/README.md)，增长指标口径见 [docs/growth/README.md](./docs/growth/README.md)。

## Security & Trust

- 写入、Bash 和外部 CLI 流程必须通过明确参数、preflight、artifact 范围和验证证据约束；不建议用全局权限绕过作为默认运行方式。
- 公开仓库不存放真实 consumer profile、endpoint、凭据、私有仓库地址、业务规则或私有知识库。
- 本地默认质量门是 `node scripts/validate-all.mjs`；Windows 无 Bash 时，Bash-dependent 检查只能报告为 skipped，不能报告为 passed。
- 生成物漂移的聚焦检查是 `npm run validate:drift`，它确认 marketplace metadata 和 catalog 与 source-of-truth 一致。
- Surface inventory 漂移检查是 `node scripts/generate-surface-inventory.mjs`，它确认 command、skill、agent、pack 和 generated marketplace output 的派生清单是最新的。
- 维护者发布前检查使用 `npm run validate:maintainer`，它在默认质量门之外还运行 `npm test`，并检查 generated registry 漂移和 `git diff --check`。
- 测试覆盖率证据使用 `npm run test:coverage:check`，它通过 Node 内置 coverage 写入 `.metrics/coverage/`，要求所有受 Git 跟踪、非 `tests/**` 的维护 `.mjs` 都进入覆盖率分母，并执行 lines 85%、branches 60%、functions 90% 的发布阻断门槛；`npm run test:coverage` 保持仅采集模式。
- Release checksum 证据使用 `node scripts/generate-release-checksums.mjs`，它通过 Node 内置 crypto 为选定 source-controlled release artifacts 生成 SHA-256 清单。
- Claude 插件安装 smoke 的安全预览路径是 `node scripts/validate-plugin-install.mjs --dry-run`；真实 user-scope 安装/更新只应在隔离用户或 CI profile 中显式运行 `--accept-user-scope-mutation --isolated-home`。
- 固定答案 route smoke 只证明 installation、invocation 与 safety contract；workflow 质量声明必须来自隐藏标签、paired baseline 的独立行为评估。
- 安全问题请按 [SECURITY.md](./SECURITY.md) 私下披露，不要在公开 issue 中暴露漏洞细节。

## 当前状态

<table>
<tr>
<td><strong>插件版本</strong></td>
<td>4.0.0</td>
</tr>
<tr>
<td><strong>主插件</strong></td>
<td><code>nova-plugin</code></td>
</tr>
<tr>
<td><strong>命令 / Skills</strong></td>
<td>21 个命令，6 个 canonical skills</td>
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

默认本地质量门是：

```bash
node scripts/validate-all.mjs
```

该入口覆盖 schema、registry fixtures、Claude 兼容性、command / skill frontmatter、canonical workflow 和 adapter 漂移、route 与 workflow-quality eval 数据集、core agent 集合、capability pack 结构、hooks、GitHub workflow 权限、库存和 required-check 合约（包括 action SHA pinning、NPM Test gate 和 Test Coverage evidence）、Codex runtime smoke、surface inventory 漂移、分发风险扫描、核心回归检查、workflow fixture 合约、Markdown 链接和命令文档覆盖。

生成 marketplace、metadata 和 catalog 漂移的聚焦检查是：

```bash
npm run validate:drift
```

维护者发布前质量门是：

```bash
npm run validate:maintainer
```

该入口会运行默认质量门、`npm test`、生成 registry 漂移检查和 `git diff --check`。
运行环境诊断可用：

```bash
npm run doctor
```

## Quick Start

最短上手路径见 [docs/getting-started.md](./docs/getting-started.md)。

常规工作流优先使用五个主入口：

```text
/nova-plugin:explore -> /nova-plugin:produce-plan -> /nova-plugin:review -> /nova-plugin:implement-plan -> /nova-plugin:finalize-work
```

| 当前目标 | 默认命令 | 说明 |
| --- | --- | --- |
| 先理解问题，不要方案 | `/nova-plugin:explore` | 收集事实、不确定性和风险信号。 |
| 需要可评审计划 | `/nova-plugin:produce-plan` | 输出正式计划，供后续 review 和 implementation 使用。 |
| 审查计划、代码或风险 | `/nova-plugin:review` | 默认标准级别，可用 `LEVEL=lite|strict` 调整深度。 |
| 按已批准计划实施 | `/nova-plugin:implement-plan` | 需要明确的 plan 和 `PLAN_APPROVED=true`。 |
| 交付总结和后续事项 | `/nova-plugin:finalize-work` | 固化 changed files、validation、限制和 next steps。 |

## Command Map

新用户和 consumer profile 默认优先使用五个主入口：`/nova-plugin:explore`、`/nova-plugin:produce-plan`、`/nova-plugin:review`、`/nova-plugin:implement-plan`、`/nova-plugin:finalize-work`。不确定下一步时先用只读 `/nova-plugin:route`。其它命令保留为高级/兼容入口，不改变既有行为。

| 阶段 | 目标 | 主入口 | 高级/兼容入口 |
| --- | --- | --- | --- |
| Explore | 选择入口、理解问题、收集事实、暴露不确定性 | `/nova-plugin:route`, `/nova-plugin:explore` | `/nova-plugin:senior-explore`, `/nova-plugin:explore-lite`, `/nova-plugin:explore-review` |
| Plan | 输出实现方案或设计文档 | `/nova-plugin:produce-plan` | `/nova-plugin:plan-lite`, `/nova-plugin:plan-review`, `/nova-plugin:backend-plan` |
| Review | 审查代码、计划或分支风险 | `/nova-plugin:review` | `/nova-plugin:review-lite`, `/nova-plugin:review-only`, `/nova-plugin:review-strict`, `/nova-plugin:codex-review-only`, `/nova-plugin:codex-verify-only` |
| Implement | 按计划实施 | `/nova-plugin:implement-plan` | `/nova-plugin:implement-standard`, `/nova-plugin:implement-lite`, `/nova-plugin:codex-review-fix` |
| Finalize | 交付总结、风险、验证与后续事项 | `/nova-plugin:finalize-work` | `/nova-plugin:finalize-lite` |

Codex 闭环是高级路径，需要 Codex CLI 和 Bash：

```text
/nova-plugin:codex-review-only -> 修复 -> /nova-plugin:codex-verify-only
```

也可以使用半自动闭环：

```text
/nova-plugin:codex-review-fix
```

## Core Agents + Packs

`nova-plugin` 的 agent 体系由 6 个短小、route-focused 的 core agents 承担通用职责，再通过 8 个 capability packs 补充领域规则。Packs 是文档化能力包，不做复杂运行时动态加载；已安装插件只作为 enhanced mode，缺失时必须可通过 fallback mode 完成任务。

| Core agent | 职责 |
| --- | --- |
| `orchestrator` | 拆解任务、选择 agent + pack、合并结果、发现缺失输入。 |
| `architect` | 架构方案、边界、风险、迁移计划、技术决策。 |
| `builder` | 实现、重构、集成、按计划修改项目文件。 |
| `reviewer` | 代码、设计、安全、质量审查，输出优先级发现。 |
| `verifier` | 测试、静态检查、依赖安全、CI/local validation。 |
| `publisher` | README、docs、CHANGELOG、release notes、handoff。 |

Capability packs: `java`, `security`, `dependency`, `docs`, `release`, `marketplace`, `frontend`, `mcp`。

## Five-Layer Architecture

`nova-plugin` 可以按五层维护：规则记忆、skill 行为契约、确定性护栏、core-agent 委派和 marketplace 分发。完整说明见 [Agent Development Stack](./nova-plugin/docs/architecture/agent-development-stack.md)。

| 层 | 当前事实源 | 维护重点 |
| --- | --- | --- |
| Memory | `CLAUDE.md`、`AGENTS.md`、`docs/consumers/` | Claude 规范事实源、非 Claude agent 适配、consumer profile 边界、公开/私有信息分离。 |
| Skills | `nova-plugin/skills/`、`nova-plugin/commands/` | command / skill 一对一、参数、安全边界和输出契约。 |
| Guardrails | `nova-plugin/hooks/`、`scripts/validate-*.mjs` | hook、schema、frontmatter、docs 和发布校验。 |
| Delegation | `nova-plugin/agents/`、`nova-plugin/packs/` | 6 个 core agents、8 个 capability packs、enhanced / fallback 路由。 |
| Distribution | `.claude-plugin/`、`nova-plugin/.claude-plugin/plugin.json` | marketplace metadata、生成 catalog、安装分发边界。 |

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
|   |-- skills/                       # 6 个 canonical nova-* skills + _shared 策略
|   |-- agents/                       # 6 个 core active agents
|   |-- packs/                        # 8 个 capability pack 文档
|   |-- docs/                         # 用户文档、命令文档和当前架构说明
|   `-- hooks/                        # Claude Code hook 配置和脚本
|-- docs/                             # 仓库文档、consumer 契约、示例、prompt、release 与 marketplace 指南
|   `-- generated/                    # 派生 surface inventory，不手工编辑
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
| 维护仓库检查、CI 和发布 gate | [Maintainer quickstart](./docs/maintainers/quickstart.md) |
| 查看公共 API 和兼容边界 | [Public API compatibility](./docs/compatibility/public-api.md) |
| 准备发布证据 | [Release evidence template](./docs/releases/release-evidence-template.md) |
| 了解 agent routing 和 capability packs | [Core agent 路由](./docs/agents/ROUTING.md)、[Capability packs](./nova-plugin/packs/README.md) |
| 阅读英文概览 | [English overview](./nova-plugin/docs/overview/README.en.md) |

## Maintenance

主要事实源：

- `nova-plugin/.claude-plugin/plugin.json`：插件元信息与版本事实源
- `.claude-plugin/registry.source.json`：registry、marketplace 展示字段和 trust/risk/maintainer/evidence 元数据事实源
- `.claude-plugin/marketplace.json`、`.claude-plugin/marketplace.metadata.json`、`docs/marketplace/catalog.md`：生成输出，不要手工编辑
- `CHANGELOG.md`、`SECURITY.md`、`CLAUDE.md`、`AGENTS.md`：版本、支持范围、库存或行为边界变化时同步
- `package.json` / `package-lock.json`：维护者便捷脚本与锁定的开发期 Ajv schema 工具链；先运行 `npm ci --ignore-scripts`。分发的 `nova-plugin` 归档不携带 Node package 运行时依赖；发布归档使用 `release:artifacts` 而不是通用 `build`

Skill 是行为事实源，command 仅是生成的入口 wrapper：

```text
workflow-specs/workflows.json
  -> nova-plugin/skills/nova-<canonical-surface>/SKILL.md
  -> nova-plugin/commands/<id>.md
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

稳定推广对象是正式 release tag，例如 `v4.0.0`。`main` 可能包含 `CHANGELOG.md` `Unreleased` 下的后续文档或优化工作，不能替代 release tag 作为安装、推广或发布证据。

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
npm run doctor
npm run demo:route
npm run demo:review
npm run test
npm run test:coverage
npm run test:coverage:check
npm run test:unit
npm run test:integration
npm run test:e2e
npm run lint
npm run ci:quick
npm run ci:full
npm run validate
npm run validate:drift
npm run validate:maintainer
npm run validate:docs
npm run validate:schemas
npm run validate:github-workflows
npm run validate:runtime
npm run validate:regression
npm run validate:surface
npm run validate:workflow
npm run scan:secrets
npm run scan:distribution
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
node scripts/validate-github-workflows.mjs
node scripts/validate-runtime-smoke.mjs
node scripts/generate-surface-inventory.mjs
node scripts/scan-distribution-risk.mjs
node scripts/validate-regression.mjs
node scripts/validate-workflow-fixtures.mjs
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

Claude 插件安装 smoke 的 dry run 不会调用 Claude CLI，也不会修改 user-scope 插件状态。真实安装/更新 smoke 需要 Claude CLI，且会修改 user-scope 插件状态，因此只应在隔离用户或 CI profile 中显式运行：

```bash
node scripts/validate-plugin-install.mjs --dry-run
node scripts/validate-plugin-install.mjs --accept-user-scope-mutation --isolated-home
```

默认 PR CI 只运行 dry run；tag release workflow 会在 disposable runner 上运行 isolated user-scope install smoke 并阻断发布，手动或定时的 `.github/workflows/plugin-install-smoke.yml` 继续提供独立安装 smoke 证据。

## Contributing

提交 PR 前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。安全问题请按 [SECURITY.md](./SECURITY.md) 私下披露。项目路线见 [ROADMAP.md](./ROADMAP.md)。

## License

本项目使用 [MIT License](./LICENSE)。

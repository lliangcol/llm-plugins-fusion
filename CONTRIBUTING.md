# Contributing to llm-plugins-fusion

感谢你对 **nova-plugin** 的兴趣。本指南说明如何提交 issue、PR，以及本仓库的工程约定。

## 行为准则

参与本项目即表示你接受 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)。

## 提交 Issue

- **Bug 报告**：请提供可复现步骤、Claude Code / 插件版本、平台（Windows / macOS / Linux）、相关命令或 skill 名。
- **Docs / contract drift**：请指出不一致的公开表面，例如 command / skill
  映射、agent 或 pack 数量、generated inventory、marketplace metadata、CI
  check 名称、release evidence 或 validation 文档。
- **功能建议**：说明场景、当前痛点、预期行为。优先参考 [ROADMAP.md](./ROADMAP.md) 判断是否已在计划内。
- **Showcase 或增长反馈**：只提交 public-safe 示例、采用反馈或生态建议；不要包含真实 consumer 资料。
- **安全问题**：请**不要**在公开 issue 中披露，改用 [SECURITY.md](./SECURITY.md) 描述的私下渠道。

仓库 issue creation 应保持开放，但 blank issues 保持关闭；请使用跟踪的
issue forms。若 GitHub UI 暂时限制 issue creation，维护者需要在 release 或
PR evidence 中记录该 owner-side 设置状态，而不是把公开安全问题引导到普通
issue。

## 第一次贡献路径

适合首次贡献者的改动应当小、可审查、可本地验证，并保持 public-safe：

| 任务类型 | 合适的改动 | 最小验证 |
| --- | --- | --- |
| Docs clarification | 修正含糊说明、链接上下文、跳过检查解释或 release evidence wording。 | `npm run validate:docs`, `git diff --check` |
| Fixture update | 改进 `fixtures/demo/` 或 `fixtures/workflow/` 的 fictional 输入、expected signals 或 redaction wording。 | `npm run demo:route`, `npm run demo:review`, `node scripts/validate-workflow-fixtures.mjs` |
| Validator message improvement | 让失败消息更具体，但不放宽现有规则。 | `node scripts/validate-regression.mjs`, affected focused check |
| Public-safe example | 增加或澄清 redacted examples、prompt templates 或 consumer profile contracts。 | `node scripts/validate-docs.mjs`, `node scripts/scan-distribution-risk.mjs` |

维护者会在 GitHub 上手动使用 `good first issue` 和 `help wanted` 标签；本仓库
当前没有 source-controlled label sync automation。若你想提议一个适合首次贡献的
任务，请使用 feature request 表单，并说明建议的文件范围和最小验证命令。

问题咨询、bug、功能建议和 showcase feedback 都应走现有 issue forms。不要记录
不存在的论坛、聊天室或 public portal 作为支持渠道。

## 公开贡献边界

- 本仓库只接收可公开维护的 workflow、consumer profile 契约、脱敏模板、
  prompt 模板、capability pack 指南、验证脚本和 marketplace metadata。
- 不要在 issue、PR、示例、模板、review notes 或 validation output 中包含真实
  consumer 名称、私有路径、endpoint、凭据、仓库地址、runtime flags、业务规则、
  客户数据、私有截图或私有知识库内容。
- 不要把贡献描述成 public portal、付费 marketplace、production multi-plugin
  directory、runtime dynamic loading 或大量领域命令扩张，除非 roadmap evidence
  和 release evidence 已经明确激活该方向。
- 不要用放宽全局权限、agent sandbox 或 workflow token scope 来掩盖缺失工具、
  缺失 Bash、缺失 CLI 或缺失平台检查。把这类状态记录为 skipped、pending
  或 not run，并说明替代 CI/Linux 或 owner-verified evidence。

## 提交 Pull Request

### 准备工作

1. Fork 本仓库，从 `main` 切出特性分支：`git checkout -b feat/<topic>`。
2. 准备 Node.js 20+，用于运行仓库级 schema、Claude 兼容性、frontmatter、pack、hooks 与 docs 校验脚本。
3. 若要验证 active agents，在 macOS / Linux / Git Bash 中运行 Bash 脚本，或在 Windows PowerShell 中运行对应 `.ps1` 脚本。
4. 若要执行 hook 脚本语法检查和 Codex runtime smoke，需要 Bash（macOS/Linux、Git Bash、WSL 或其他 PATH 中可用的 `bash`）。Windows 本地没有 Bash 时，`node scripts/validate-all.mjs` 会 warning 跳过本地 Bash-dependent 检查；CI/Linux 仍必须执行并通过。
   ```bash
   node scripts/validate-all.mjs
   ```
5. 可选使用维护者 npm 便捷入口；`package.json` 包含 dependency-free 的
   `lint` 和 `test` 入口，仍不声明 `check` / `build` 脚本名。
   ```bash
   npm run validate
   npm run validate:drift
   npm run validate:docs
   npm run validate:schemas
   npm run validate:github-workflows
   npm run validate:runtime
   npm run validate:regression
   npm run scan:secrets
   npm run scan:distribution
   ```

   Consumer profile scaffold 需要参数，例如：
   ```bash
   npm run scaffold:consumer -- --type java-backend --out <dir>
   ```

### 工程约定

- **Agent 与 pack 数量**：`nova-plugin/agents/` 目录内 6 个 core agents 由 `scripts/verify-agents.sh` / `scripts/verify-agents.ps1` 校验；`nova-plugin/packs/` 目录内 8 个 capability packs 由 `scripts/validate-packs.mjs` 校验。
- **Frontmatter 规范**：
  - `commands/*.md` 必需字段：`id`、`stage`、`title`、`description`、`destructive-actions`（枚举 `none|low|medium|high`）、`allowed-tools`、`invokes.skill`。
  - `skills/*/SKILL.md` 必需字段：`name`、`description`、`license`、`allowed-tools`（空格分隔字符串）、`metadata.novaPlugin.*`（`userInvocable` / `autoLoad` / `subagentSafe` / `destructiveActions`）。
- **JSON Schema**：`registry.source.json` / `marketplace.json` / `marketplace.metadata.json` / `plugin.json` 改动后必须通过 `node scripts/validate-schemas.mjs`。
- **Registry 生成**：`.claude-plugin/marketplace.json` 与 `.claude-plugin/marketplace.metadata.json` 是生成产物。维护 registry 时改 `nova-plugin/.claude-plugin/plugin.json` 与 `.claude-plugin/registry.source.json`，再运行 `node scripts/generate-registry.mjs --write`。
- **Catalog 生成**：`docs/marketplace/catalog.md` 同样由 registry source 生成，不手工编辑。它展示当前插件 entry、maintainer、trust/risk、compatibility evidence 和 review policy 链接。
- **Registry fixture**：多插件 entry 生成能力由 `fixtures/registry/multi-plugin/` 和 `node scripts/validate-registry-fixtures.mjs` 覆盖，确保未来多 entry 不破坏当前单插件布局。
- **Claude 兼容性**：官方 marketplace manifest 改动后必须通过 `node scripts/validate-claude-compat.mjs`；若本机存在 Claude CLI，该脚本会运行 `claude plugin validate .` 和 `claude plugin validate nova-plugin`。
- **Hook 校验**：hook 配置或脚本改动后运行 `node scripts/validate-hooks.mjs`；Bash 可用时还要运行两个 hook 脚本的 `bash -n`。
- **Runtime smoke**：Codex Bash helper 脚本或其调用方式变更后运行 `node scripts/validate-runtime-smoke.mjs`；它只校验语法、help 输出和安全失败路径，不调用 Codex，也不写 `.codex/`。
- **分发风险扫描**：发布、文档、模板或 marketplace 变更后运行 `node scripts/scan-distribution-risk.mjs`，确认活跃分发内容不含真实密钥、JWT、npm token、云厂商 key、机器本地路径、私网地址、内部 endpoint、私有 SSH repo URL 或真实 `.env` 值。历史归档发现只能作为 redacted warning 或 `scripts/distribution-risk.allowlist.json` 中的 allowlisted warning。
- **回归校验**：验证脚本、registry 生成、分发风险扫描或 command/docs drift 规则变更后运行 `node scripts/validate-regression.mjs`。
- **Surface inventory**：command、skill、agent、pack 或 generated marketplace
  output 清单规则变更后运行
  `node scripts/generate-surface-inventory.mjs --write`，再运行
  `node scripts/generate-surface-inventory.mjs`。
- **文档校验**：用户文档、命令文档、版本日期、安全支持范围、活跃规划文字或报告归档改动后运行 `node scripts/validate-docs.mjs`；它会校验 Markdown 本地链接与锚点、命令文档 stage 位置、版本日期同步、`SECURITY.md` 当前 MINOR 支持范围、活跃文档中的陈旧规划标签和非归档报告状态。
- **Pack 校验**：capability pack 或 plugin-aware routing 改动后运行 `node scripts/validate-packs.mjs`；每个 pack 必须包含 enhanced mode 和 fallback mode。
- **命令文档组织**：常规命令文档按工作流 stage 放在 `nova-plugin/docs/commands/<stage>/`；Codex 三个命令文档集中放在 `nova-plugin/docs/commands/codex/`，这是维护规则的明确例外。

### 变更类型与版本

本仓库采用 [Semantic Versioning](https://semver.org/)。插件版本写在 `nova-plugin/.claude-plugin/plugin.json` 的 `version` 字段：

| 变更 | 版本位 | 示例 |
| --- | --- | --- |
| 破坏性变更（命令删除 / 重命名 / 行为回归） | MAJOR | `1.x.x → 2.0.0` |
| 新增命令 / skill / agent / capability pack，或能力显著增强 | MINOR | `1.0.x → 1.1.0` |
| Bug 修复、文档更新、内部重构 | PATCH | `1.0.7 → 1.0.8` |

每次版本变更需要同步：
- `nova-plugin/.claude-plugin/plugin.json` 的 `version`
- `.claude-plugin/registry.source.json` 的 `last-updated`
- 生成后的 `.claude-plugin/marketplace.json` 的 `plugins[].version`
- 生成后的 `.claude-plugin/marketplace.metadata.json` 的 `plugins[].version`、`last-updated`
- 生成后的 `docs/marketplace/catalog.md`
- `CHANGELOG.md` 新增条目

## 添加或维护 marketplace entry

新增或修改插件 entry 时，请先阅读 [Registry Author Workflow](./docs/marketplace/registry-author-workflow.md)。核心规则：

1. 插件自有字段写在 `<plugin>/.claude-plugin/plugin.json`。
2. marketplace 展示字段和 repository-local metadata 写在 `.claude-plugin/registry.source.json`。
3. 每个 entry 都必须声明 maintainer、trust/risk/deprecated/last-updated、compatibility evidence 和 review policy 链接。
4. 运行 `node scripts/generate-registry.mjs --write` 生成 marketplace、metadata 和 catalog。
5. 运行 `npm run validate:drift`、`node scripts/validate-schemas.mjs`、`node scripts/validate-registry-fixtures.mjs`、`node scripts/validate-claude-compat.mjs`、`node scripts/scan-distribution-risk.mjs` 和 `node scripts/validate-docs.mjs`。

PR 需要说明 metadata rationale、安全影响、维护 owner 和本地校验输出；仓库模板见 [`.github/pull_request_template.md`](./.github/pull_request_template.md)。

### 提交信息

推荐 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat(skills): add nova-codex-verify-only
fix(commands): correct allowed-tools for review-strict
docs(readme): update quickstart
chore(schemas): tighten plugin.schema.json enum
```

### 本地检查清单

提 PR 前请依次通过：

```bash
# 1. schema 校验
node scripts/generate-registry.mjs
node scripts/validate-schemas.mjs
node scripts/validate-registry-fixtures.mjs

# 2. Claude 兼容性校验
node scripts/validate-claude-compat.mjs

# 3. commands / skills frontmatter 校验
node scripts/lint-frontmatter.mjs

# 4. agent 校验
bash scripts/verify-agents.sh

# 5. pack 校验
node scripts/validate-packs.mjs

# 6. hook 配置校验
node scripts/validate-hooks.mjs

# 7. hook Bash 语法校验（需要 Bash）
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh

# 8. Codex runtime smoke（需要 Bash，Windows 无 Bash 时 warning-skip）
node scripts/validate-runtime-smoke.mjs

# 9. 分发风险扫描
node scripts/scan-distribution-risk.mjs

# 10. 核心回归校验
node scripts/validate-regression.mjs

# 11. docs 校验
node scripts/validate-docs.mjs
```

也可以运行总入口：

```bash
node scripts/validate-all.mjs
```

## 添加新命令 / 新 skill

每个命令与 skill 采用 1:1 映射：

| 类型 | 文件位置 | 命名 |
| --- | --- | --- |
| 命令 | `nova-plugin/commands/<id>.md` | `<id>` |
| skill | `nova-plugin/skills/nova-<id>/SKILL.md` | `nova-<id>` |
| skill 文档 | `nova-plugin/skills/nova-<id>/README.md` | 可选，复杂 skill 推荐 |
| 命令文档 | `nova-plugin/docs/commands/<stage>/<id>.md`、`<id>.README.md`、`<id>.README.en.md` | 命令使用说明 |

Codex 命令文档使用集中目录 `nova-plugin/docs/commands/codex/`，不按 Review / Implement stage 拆分；仍需满足 `<id>.md`、`<id>.README.md`、`<id>.README.en.md` 三件套。

添加后同步更新：
- `README.md` 中的命令总览表
- `nova-plugin/skills/README.md` 或相关用户文档
- `CHANGELOG.md`

## 初始化 consumer profile

公开仓库只提供 redacted 模板。要在 consumer-owned 工作区初始化本地 profile，
先 dry-run：

```bash
node scripts/scaffold-consumer-profile.mjs --type java-backend --out <dir>
node scripts/scaffold-consumer-profile.mjs --type frontend --out <dir>
node scripts/scaffold-consumer-profile.mjs --type workbench --out <dir>
```

确认输出目录属于私有 consumer 工作区后再添加 `--write`。不要把生成后的私有
事实、路径、endpoint、凭据、仓库地址或业务规则提交回本公开仓库。

## License

提交的代码默认以 MIT License 合并入仓库，与项目整体协议一致。

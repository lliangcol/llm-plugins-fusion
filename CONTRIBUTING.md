# Contributing to llm-plugins-fusion

感谢你对 **nova-plugin** 的兴趣。本指南说明如何提交 issue、PR，以及本仓库的工程约定。

## 行为准则

参与本项目即表示你接受 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)。

## 提交 Issue

- **Bug 报告**：请提供可复现步骤、Claude Code / 插件版本、平台（Windows / macOS / Linux）、相关命令或 skill 名。
- **功能建议**：说明场景、当前痛点、预期行为。优先参考 [ROADMAP.md](./ROADMAP.md) 判断是否已在计划内。
- **安全问题**：请**不要**在公开 issue 中披露，改用 [SECURITY.md](./SECURITY.md) 描述的私下渠道。

## 提交 Pull Request

### 准备工作

1. Fork 本仓库，从 `main` 切出特性分支：`git checkout -b feat/<topic>`。
2. 准备 Node.js 20+，用于运行仓库级 schema、Claude 兼容性、frontmatter、pack、hooks 与 docs 校验脚本。
3. 若要验证 active agents，在 macOS / Linux / Git Bash 中运行 Bash 脚本，或在 Windows PowerShell 中运行对应 `.ps1` 脚本。
4. 若要执行 hook 脚本语法检查，需要 Bash（macOS/Linux、Git Bash、WSL 或其他 PATH 中可用的 `bash`）。Windows 本地没有 Bash 时，`node scripts/validate-all.mjs` 会 warning 跳过 `bash -n`；CI/Linux 仍必须执行并通过。
   ```bash
   node scripts/validate-all.mjs
   ```

### 工程约定

- **Agent 与 pack 数量**：`nova-plugin/agents/` 目录内 6 个 core agents 由 `scripts/verify-agents.sh` / `scripts/verify-agents.ps1` 校验；`nova-plugin/packs/` 目录内 8 个 capability packs 由 `scripts/validate-packs.mjs` 校验。
- **Frontmatter 规范**：
  - `commands/*.md` 必需字段：`id`、`stage`、`title`、`description`、`destructive-actions`（枚举 `none|low|medium|high`）、`allowed-tools`、`invokes.skill`。
  - `skills/*/SKILL.md` 必需字段：`name`、`description`、`license`、`allowed-tools`（空格分隔字符串）、`metadata.novaPlugin.*`（`userInvocable` / `autoLoad` / `subagentSafe` / `destructiveActions`）。
- **JSON Schema**：`marketplace.json` / `marketplace.metadata.json` / `plugin.json` 改动后必须通过 `node scripts/validate-schemas.mjs`。
- **Claude 兼容性**：官方 marketplace manifest 改动后必须通过 `node scripts/validate-claude-compat.mjs`；若本机存在 Claude CLI，该脚本会运行 `claude plugin validate .` 和 `claude plugin validate nova-plugin`。
- **Hook 校验**：hook 配置或脚本改动后运行 `node scripts/validate-hooks.mjs`；Bash 可用时还要运行两个 hook 脚本的 `bash -n`。
- **文档校验**：用户文档、命令文档、版本日期或报告归档改动后运行 `node scripts/validate-docs.mjs`；它会校验 Markdown 本地链接与锚点、命令文档 stage 位置、版本日期同步和非归档报告状态。
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
- `.claude-plugin/marketplace.json` 的 `plugins[].version`
- `.claude-plugin/marketplace.metadata.json` 的 `plugins[].version`、`last-updated`
- `CHANGELOG.md` 新增条目

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
node scripts/validate-schemas.mjs

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

# 8. docs 校验
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

## License

提交的代码默认以 MIT License 合并入仓库，与项目整体协议一致。

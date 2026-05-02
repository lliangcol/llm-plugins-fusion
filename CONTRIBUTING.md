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
2. 准备 Node 20+，用于运行仓库级 schema 与 frontmatter 校验脚本。
3. 若要验证 active agents，在 macOS / Linux / Git Bash 中运行 Bash 脚本，或在 Windows PowerShell 中运行对应 `.ps1` 脚本。
   ```bash
   node scripts/validate-schemas.mjs
   node scripts/lint-frontmatter.mjs
   bash scripts/verify-agents.sh
   ```

### 工程约定

- **Agent 数量**：`nova-plugin/agents/` 目录内 active agent 集合由 `scripts/verify-agents.sh` / `scripts/verify-agents.ps1` 校验。
- **Frontmatter 规范**：
  - `commands/*.md` 必需字段：`id`、`stage`、`title`、`destructive-actions`（枚举 `none|low|medium|high`）、`allowed-tools`、`invokes.skill`。
  - `skills/*/SKILL.md` 必需字段：`name`、`description`、`license`、`allowed-tools`（空格分隔字符串）、`metadata.novaPlugin.*`（`userInvocable` / `autoLoad` / `subagentSafe` / `destructiveActions`）。
- **JSON Schema**：`marketplace.json` / `plugin.json` 改动后必须通过 `node scripts/validate-schemas.mjs`。

### 变更类型与版本

本仓库采用 [Semantic Versioning](https://semver.org/)。插件版本写在 `nova-plugin/.claude-plugin/plugin.json` 的 `version` 字段：

| 变更 | 版本位 | 示例 |
| --- | --- | --- |
| 破坏性变更（命令删除 / 重命名 / 行为回归） | MAJOR | `1.x.x → 2.0.0` |
| 新增命令 / skill / agent，或能力显著增强 | MINOR | `1.0.x → 1.1.0` |
| Bug 修复、文档更新、内部重构 | PATCH | `1.0.7 → 1.0.8` |

每次版本变更需要同步：
- `nova-plugin/.claude-plugin/plugin.json` 的 `version`
- `.claude-plugin/marketplace.json` 的 `plugins[].version`、`last-updated`
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

# 2. commands / skills frontmatter 校验
node scripts/lint-frontmatter.mjs

# 3. agent 校验
bash scripts/verify-agents.sh
```

## 添加新命令 / 新 skill

每个命令与 skill 采用 1:1 映射：

| 类型 | 文件位置 | 命名 |
| --- | --- | --- |
| 命令 | `nova-plugin/commands/<id>.md` | `<id>` |
| skill | `nova-plugin/skills/nova-<id>/SKILL.md` | `nova-<id>` |
| skill 文档 | `nova-plugin/skills/nova-<id>/README.md` | 可选，复杂 skill 推荐 |
| 命令文档 | `nova-plugin/docs/commands/<stage>/<id>.md` | 命令使用说明 |

添加后同步更新：
- `README.md` 中的命令总览表
- `nova-plugin/skills/README.md` 或相关用户文档
- `CHANGELOG.md`

## License

提交的代码默认以 MIT License 合并入仓库，与项目整体协议一致。

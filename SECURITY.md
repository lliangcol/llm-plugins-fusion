# Security Policy

## 支持范围

| 版本 | 安全修复 |
| --- | --- |
| 最新 MINOR 版本（当前 `2.2.x`） | ✅ |
| 上一 MINOR 版本 | ⚠️ 仅高危漏洞 |
| 更早版本 | ❌ |

支持范围跟随 `nova-plugin/.claude-plugin/plugin.json` 的版本事实源。稳定推广仍
必须以 exact release tag 为准；release-ready 工作树或 moving `main` 不等同于
已发布版本。

## 报告漏洞

**请不要在 GitHub 公开 issue 中披露漏洞。** 请通过以下渠道私下联系：

- Email: `lliangcoder@gmail.com`
- 邮件主题请以 `[SECURITY]` 开头

报告请尽量包含：

- 受影响的组件（命令 / skill / agent / schema / hooks / 脚本）
- 复现步骤或 PoC
- 受影响的插件版本（`nova-plugin/.claude-plugin/plugin.json` 的 `version`）
- 建议的缓解方案（可选）

## 响应时间

- **48 小时内**：确认收到报告
- **7 天内**：初步评估并给出严重度等级
- **30 天内**：对确认的漏洞给出修复计划或缓解措施

## 安全设计原则

本仓库在设计上对 LLM 工具调用风险保持警惕：

1. **默认无写权限**：`explore` / `review` 类命令的 `allowed-tools` 只含 `Read / Glob / Grep / LS`。
2. **destructive-actions 分级**：每个命令在 frontmatter 中声明 `none / low / medium / high`，配合 skill 的 `subagentSafe` 字段共同决定是否允许在 agent 自动化流中调用。
3. **Codex 闭环的安全边界**：`codex-review-fix` 等命令在 SKILL.md 中显式禁止 `git reset --hard`、`git clean -fd`、批量删除等操作。
4. **供应链**：仓库级脚本尽量使用 Node.js 内置模块与 Bash/PowerShell；CI 持续执行 schema、frontmatter 与 active agent 校验。
5. **Marketplace metadata 分层**：`trust-level`、`risk-level`、`deprecated`、`last-updated`、maintainer 与 review evidence 保留在 repository-local metadata，不写入 Claude-compatible marketplace manifest。

安全敏感的插件、registry、hook、脚本或 write-capable command 变更应按
[Security Review Route](./docs/marketplace/security-review-route.md) 执行评审。

## 披露策略

- 漏洞修复发布后，会在 `CHANGELOG.md` 中标注 `Security:` 前缀。
- 对严重漏洞，同时在 Release Notes 与 README 置顶提示至少一个 MINOR 版本周期。
- 对报告者，在其同意后在 Release Notes 中致谢。

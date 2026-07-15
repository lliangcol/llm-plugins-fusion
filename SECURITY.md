# Security Policy

<!-- generated:project-state:start -->
## Current Machine-Derived Project Facts

Do not edit this block by hand. It is synchronized by
`node scripts/generate-project-state.mjs --write` from repository domain
sources and `governance/product-lanes.json`.

- Plugin: `nova-plugin@4.1.0`; production plugins: 1; public path: `nova-plugin/`
- Runtime: Node.js `>=22`; distributed Bash helpers: `3.2+`
- Inventory: 21 commands, 6 skills, 6 active agents, 8 capability packs
- Workflow contract: schema v5, namespace `nova-plugin`, 21 workflows
- Evaluation datasets: `live-paired` has 168 cases and 2016 planned paired invocations; `real-task-benchmark` has 24 tasks and 432 planned invocations
- Package scripts: `check` is present; `build` is absent
- Active product lanes: `workflow-framework`, `single-plugin-delivery`, `release-candidate-promotion`, `live-assistant-evaluation`, `generic-framework-kernel`
- Planned product lanes: None
- Deferred product lanes: `production-multi-plugin-layout`, `public-portal`, `runtime-dynamic-loading`, `broad-domain-command-expansion`
- Release model: `candidate-and-promotion`
- Active PreToolUse launcher: `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh`, `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-bash-check.sh`
- Active PostToolUse launcher: `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-write-verify.mjs`, `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-audit-log.mjs`
<!-- generated:project-state:end -->

## 支持范围

| 版本 | 安全修复 |
| --- | --- |
| 最新 MINOR 版本（当前 `4.0.x`） | ✅ |
| 上一 MINOR 版本 | ⚠️ 仅高危漏洞 |
| 更早版本 | ❌ |

支持范围跟随 `nova-plugin/.claude-plugin/plugin.json` 的版本事实源。稳定推广仍
必须以 exact release tag 为准；release-ready 工作树或 moving `main` 不等同于
已发布版本。

## 报告漏洞

**请不要在 GitHub 公开 issue 中披露漏洞。** 请通过以下渠道私下联系：

优先使用 GitHub repository 的 **Private vulnerability reporting**（Security
tab -> Report a vulnerability）；若该入口对报告者不可用，再使用下方邮件。

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

1. **默认无项目代码写权限**：canonical `explore` / `review` 只读；兼容入口只有在契约声明显式 analysis/review artifact 时才可写该 artifact。
2. **destructive-actions 分级**：每个命令在 frontmatter 中声明 `none / low / medium / high`，配合 skill 的 `subagentSafe` 字段共同决定是否允许在 agent 自动化流中调用。
3. **Codex 闭环的安全边界**：`codex-review-fix` 等命令在 SKILL.md 中显式禁止 `git reset --hard`、`git clean -fd`、批量删除等操作。
4. **供应链**：仓库级脚本尽量使用 Node.js 内置模块与 Bash/PowerShell；CI 持续执行 schema、frontmatter 与 active agent 校验。
5. **Marketplace metadata 分层**：`trust-level`、`risk-level`、`deprecated`、`last-updated`、maintainer 与 review evidence 保留在 repository-local metadata，不写入 Claude-compatible marketplace manifest。
6. **Workspace 路径封闭**：Write/Edit guard 同时执行词法与物理路径包含检查，拒绝父路径 symlink/junction、workspace 外目标，以及所有已有目标的 hard link；无法可靠读取 `nlink` 时 fail closed。PostToolUse 对实际结果再次复验。该机制是 guardrail，不是原子 filesystem sandbox，已完成的写入无法由 PostToolUse 回滚。
7. **Bash 语法收敛**：只接受 bare executable；path-qualified executable、未引用 glob/brace/tilde/变量/命令或 process substitution、shell operator 与未登记 argv 均 fail closed。引用后的字面特殊字符仍必须通过 rule-specific validator。

安全敏感的插件、registry、hook、脚本或 write-capable command 变更应按
[Security Review Route](docs/reference/security/security-review.md) 执行评审。
本地审计日志、脱敏边界和 public-safe 数据处理规则见
[Data Handling And Local Audit Logs](docs/reference/security/data-handling.md)。

## 披露策略

- 漏洞修复发布后，会在 `CHANGELOG.md` 中标注 `Security:` 前缀。
- 对严重漏洞，同时在 Release Notes 与 README 置顶提示至少一个 MINOR 版本周期。
- 对报告者，在其同意后在 Release Notes 中致谢。

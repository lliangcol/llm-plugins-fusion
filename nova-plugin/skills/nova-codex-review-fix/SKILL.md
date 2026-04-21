---
name: nova-codex-review-fix
description: "Run a semi-automated Codex review -> Claude Code fix -> local checks -> Codex verify closure loop for the current branch. Use when Claude Code should orchestrate review-driven fixes with external Bash scripts, structured review artifacts, validation reports, merge readiness, and residual-risk summaries."
license: MIT
allowed-tools: Bash Read Glob Grep LS Edit Write
argument-hint: "Example: codex-review-fix BASE=main GOAL='fix current branch until merge-ready'"
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: false
    destructiveActions: medium
---

## 目的

执行一个面向当前分支的半自动闭环：

1. 运行 Codex review 脚本产出结构化问题报告。
2. 阅读 `必须修`、`建议修` 中高置信问题。
3. 由 Claude Code 修改代码，必要时补测试。
4. 运行本地检查脚本。
5. 运行 Codex verify 脚本确认问题是否解决。
6. 输出闭环结论、剩余风险、下一步建议。

## 何时使用

- 当前分支已经有改动，需要先 review 再修复。
- 希望让 Claude Code 负责修复与编排，Codex 只做 reviewer / verifier。
- 需要一套可沉淀到仓库、可复制到其他项目的 review-fix workflow。

## 资源导航

- 主说明：`README.md`
- Prompt 模板：`prompts/*.prompt.md`
- 外部脚本：`scripts/*.sh`

只有在需要具体调用方式、参数细节或排障说明时再读取 `README.md`。

## 执行步骤

1. 先确认当前目录是 Git 仓库，并识别默认基线分支。
2. 运行 `scripts/codex-review.sh`。
3. 读取输出目录中的 `review.md`，只提取高置信、高优先级问题。
4. 参考 `prompts/claude-fix.prompt.md` 组织修复，不做与问题无关的大改。
5. 如问题涉及行为缺口，优先补单测或集成校验。
6. 运行 `scripts/run-project-checks.sh --all --report-file .codex/codex-review-fix/latest-artifacts/checks.txt`。
7. 运行 `scripts/codex-verify.sh --review-file <review.md> --checks-file .codex/codex-review-fix/latest-artifacts/checks.txt`。
8. 读取 `verify.md`，按“已解决 / 未解决 / 不确定 / 新增高风险问题”总结。

## 优先级策略

- 先修 `必须修` 中会导致错误行为、数据风险、异常路径缺口、测试缺失的条目。
- 再处理 `建议修` 中高置信、低改动成本、能显著降低回归风险的条目。
- `可忽略` 不默认处理，除非顺手即可消除且不会扩大改动范围。

## 安全边界

- 不执行 `git reset --hard`、`git clean -fd`、批量删除等危险命令。
- 不把 Codex 产物当成绝对真理；对低置信问题保持克制。
- 不因为 review 报告而主动重构无关模块。
- 本技能默认只操作当前仓库工作区，不负责发布、部署或远程环境变更。

## 输出要求

- Review 阶段：保留 `review.md`。
- 修复阶段：总结已修改内容、未修改原因、补充测试情况。
- 校验阶段：保留 checks 输出摘要。
- Verify 阶段：保留 `verify.md`。
- 收尾：输出本轮是否建议合并、剩余阻塞项、后续建议。

## 变体

- `nova-codex-review-only`：只做 review，不进入修复闭环。
- `nova-codex-verify-only`：基于已有 `review.md` 做 verify。

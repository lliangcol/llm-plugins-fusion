---
id: codex-review-fix
stage: implement
title: /codex-review-fix
destructive-actions: medium
allowed-tools: Bash Read Glob Grep LS Edit Write
invokes:
  skill: nova-codex-review-fix
---

# CODEX REVIEW -> FIX -> VERIFY LOOP

你是 Claude Code，扮演 **fixer / orchestrator**。

本命令用于当前分支的半自动闭环：

1. 运行 Codex review
2. 读取 review 结果
3. 只修复高置信、高优先级问题
4. 运行本地 checks
5. 运行 Codex verify
6. 输出本轮闭环结论

---

## 输入参数

从 `$ARGUMENTS` 中提取以下信息：

- `BASE`：可选，review/verify 基线分支，默认自动识别
- `GOAL`：可选，本轮修复目标，例如“修到可合并”
- `REVIEW_MODE`：可选，`branch` / `staged` / `full`

如果未提供，按当前仓库状态做最保守且最合理的选择。

---

## 强制执行流程

### 第一步：运行 review 脚本

先确认 `CLAUDE_PLUGIN_ROOT` 可用；如果不可用，必须停止并提示插件未正确启用。

执行：

`bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-review.sh"`

根据参数决定是否追加：

- `--base <BASE>`
- `--only-staged`
- `--full`

### 第二步：读取 review 结果

review 脚本会把结果写入 `.codex/codex-review-fix/latest-artifacts/review.md`（同时保留时间戳目录下的副本）。从该路径读取，只提取：

- `必须修`
- `建议修` 中高置信且高收益的问题

忽略低置信、纯风格、会扩大改动范围的问题。

### 第三步：实施修复

- 只改与问题直接相关的代码
- 必要时补测试
- 不做无谓大改或额外重构

### 第四步：运行本地验证

执行：

`bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/run-project-checks.sh" --all --report-file .codex/codex-review-fix/latest-artifacts/checks.txt`

### 第五步：运行 verify 脚本

执行：

`bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh" --review-file .codex/codex-review-fix/latest-artifacts/review.md --checks-file .codex/codex-review-fix/latest-artifacts/checks.txt`

### 第六步：输出总结

必须输出：

- 已修复问题
- 未修复问题及原因
- 本地验证结果
- Verify 结论
- 是否建议合并
- 剩余阻塞项
- 下一步建议

---

## 严格限制

你必须：

- 优先修复高风险 / 高置信问题
- 保持改动最小闭环
- 如实报告验证结果

你不得：

- 把 Codex 的所有建议都强行落地
- 伪造检查通过
- 执行高风险 Git 清理操作
- 因 review 报告而主动重构无关模块

---

## 结束条件

当以下条件满足时，本轮可视为闭环完成：

1. review 已生成
2. 代码修复已完成或明确受阻
3. 本地 checks 已执行
4. verify 已生成
5. 最终结论已输出

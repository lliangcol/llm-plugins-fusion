---
name: nova-codex-verify-only
description: "Run Codex verification against an existing review.md and the current branch state. Use when Claude Code or a human has already applied fixes and only needs a focused verify pass, merge recommendation, and residual blockers."
license: MIT
allowed-tools: Bash Read Glob Grep LS
argument-hint: "Example: codex-verify-only REVIEW_FILE=.codex/codex-review-fix/latest-artifacts/review.md CHECKS_FILE=.codex/codex-review-fix/latest-artifacts/checks.txt"
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: true
    destructiveActions: none
---

## 目的

基于已有 `review.md` 做定向 verify。

## 使用方式

1. 确认上一轮 `review.md` 路径
2. 如有本地 checks 输出，一并提供 `CHECKS_FILE`
3. 先确认 `CLAUDE_PLUGIN_ROOT` 可用，然后调用 `${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh --review-file <path>`
4. 阅读 `verify.md`，确认已解决、未解决和剩余阻塞项

## 适用场景

- 修复完成后做复验
- 多轮修复后判断是否可合并
- 只想验证已知问题，而不是重新做开放式审查

## 安全边界

- 不做新实现
- 只在高置信时报告新增高风险问题
- 重点验证上一轮 review 项是否关闭

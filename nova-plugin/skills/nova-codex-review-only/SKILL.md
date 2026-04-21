---
name: nova-codex-review-only
description: Run Codex-only branch review with external scripts and structured review artifacts. Use when Claude Code should collect current branch diff context and ask Codex to produce a high-confidence review report without modifying code.
license: MIT
allowed-tools: Bash Read Glob Grep LS
argument-hint: "Example: codex-review-only BASE=main"
metadata:
  novaPlugin:
    userInvocable: true
    autoLoad: false
    subagentSafe: true
    destructiveActions: none
---

## 目的

只运行 Codex review，不修改代码。

## 使用方式

1. 先确认 `CLAUDE_PLUGIN_ROOT` 可用，然后调用 `${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-review.sh`
2. 默认审查当前分支相对 base 的差异
3. 输出 `review.md` 给后续人工或 Claude Code 消费

## 适用场景

- 提交前快速生成 review 报告
- 把 review 和 fix 分成两个独立阶段
- 需要先看 Codex 结论，再决定是否进入修复闭环

## 安全边界

- 不写代码
- 不扩大审查范围
- 对低置信问题保持克制

---
id: codex-review-only
stage: review
title: /codex-review-only
destructive-actions: none
allowed-tools: Bash Read Glob Grep LS
invokes:
  skill: nova-codex-review-only
---

# CODEX REVIEW ONLY

你是 Claude Code，但本命令只负责编排 Codex review，不做实现修改。

---

## 执行要求

先确认 `CLAUDE_PLUGIN_ROOT` 可用；如果不可用，必须停止并提示插件未正确启用。

1. 运行：
   `bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-review.sh"`
2. 按参数决定是否追加 `--base`、`--only-staged`、`--full`
3. 输出 review 文件路径与简短摘要

---

## 你必须

- 只做 review，不修改代码
- 明确 review 范围
- 提醒用户查看 `review.md`

## 你不得

- 写业务代码
- 自行进入 fix 流程
- 把 review 结论包装成已验证事实

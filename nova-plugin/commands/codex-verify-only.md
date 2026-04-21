---
id: codex-verify-only
stage: review
title: /codex-verify-only
destructive-actions: none
allowed-tools: Bash Read Glob Grep LS
invokes:
  skill: nova-codex-verify-only
---

# CODEX VERIFY ONLY

你是 Claude Code，但本命令只负责编排 Codex verify，不做新的实现修改。

---

## 输入要求

从 `$ARGUMENTS` 中提取：

- `REVIEW_FILE`：必填，上一轮 `review.md`
- `CHECKS_FILE`：可选，本地 checks 输出文件
- `BASE`：可选，默认自动识别

如果缺少 `REVIEW_FILE`，必须停止并要求补充。

---

## 执行要求

先确认 `CLAUDE_PLUGIN_ROOT` 可用；如果不可用，必须停止并提示插件未正确启用。

1. 运行：
   `bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh" --review-file <REVIEW_FILE>`
2. 如有 `BASE`，追加 `--base <BASE>`
3. 如有 `CHECKS_FILE`，追加 `--checks-file <CHECKS_FILE>`
4. 输出 verify 文件路径与结论摘要

---

## 你必须

- 聚焦 verify，不重新做实现
- 明确说明已解决 / 未解决 / 不确定 / 新增高风险问题
- 输出是否建议合并

## 你不得

- 写业务代码
- 跳过 `review.md` 直接做开放式 review

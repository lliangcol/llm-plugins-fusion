# /codex-review-fix

- 来源：`nova-plugin/commands/codex-review-fix.md`
- 资源目录：`nova-plugin/skills/nova-codex-review-fix/`

## 命令定位

- 用于当前分支的 Codex review/fix/verify 半自动闭环
- 适用：需要可重复执行、可沉淀产物、可做多轮复验的修复流程
- 不该用于：纯只读 review 或完全不需要 Codex 参与的本地小修

## 参数说明

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `BASE` | No | 基线分支 | `main` |
| `GOAL` | No | 本轮目标 | `修到可合并` |
| `REVIEW_MODE` | No | `branch` / `staged` / `full` | `full` |

## 资源说明

- `scripts/codex-review.sh`：生成 review 报告
- `scripts/run-project-checks.sh`：统一项目校验入口
- `scripts/codex-verify.sh`：对上一轮问题做 verify
- `prompts/*.prompt.md`：Codex/Claude Code 的提示模板

## 典型示例

```text
/codex-review-fix BASE=main GOAL="修复当前分支直到可合并"
```

```text
/codex-review-fix REVIEW_MODE=staged GOAL="只处理已暂存改动中的高风险问题"
```

## 相关脚本直接调用

插件运行时建议使用 `${CLAUDE_PLUGIN_ROOT}`，避免依赖用户当前仓库里存在 `nova-plugin/` 目录。

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-review.sh" --base main
bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/run-project-checks.sh" \
  --all \
  --report-file .codex/codex-review-fix/latest-artifacts/checks.txt
bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh" \
  --review-file .codex/codex-review-fix/latest-artifacts/review.md \
  --checks-file .codex/codex-review-fix/latest-artifacts/checks.txt \
  --base main
```

## 输出说明

- `review.md`：Codex 审查结论
- `verify.md`：Codex 复验结论
- `checks.txt`：本地 checks 完整输出
- `artifacts/*`：范围说明、patch、git 状态、最终 prompt 归档

## 与相近命令对比

- `/codex-review-only`：只生成 review 报告，不修复
- `/codex-verify-only`：只基于已有 review 做 verify
- `/review-only`：纯 Claude Code 评审，不调用外部 Codex 脚本

# Skill: /codex-review-only

- 来源：`nova-plugin/commands/codex-review-only.md`

## 适用场景

- 只想先拿到 Codex 对当前分支的 review 报告
- 希望把 review 和 fix 分开执行
- 需要将 review 结果沉淀成 `review.md`

## 输入参数

### Optional

- `BASE`: 基线分支
- `REVIEW_MODE`: `branch` / `staged` / `full`

## 详细执行步骤

1. 调 `codex-review.sh`
2. 输出 `review.md` 路径
3. 简述 `必须修` / `建议修` 摘要

## 输出规范

- 不修改代码
- 提供 review 文件路径与简要结论

# Skill: /nova-plugin:codex-review-fix

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `codex-review-fix`; stage: `implement`; canonical skill: `nova-implement-plan`
- Purpose: Run an external Codex review, fix high-confidence findings, run project checks, and verify closure.
- Audience: `codex-users`; support risk: `medium`
- Inputs: `REVIEW_SCOPE` (required), `BASE`, `REVIEW_MODE`, `INCLUDE_UNTRACKED_CONTENT`
- Output contract: `codex-review-fix-v2`; authorization: `external-review-implementation`
- Effects: `credentials`, `network`, `shell`, `workspace-read`, `workspace-write`
- Related workflows: `codex-review-only`, `codex-verify-only`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/codex-review-fix.md`

## 适用场景

- 当前分支已存在一批改动，需要先 review 再修复
- 希望让 Claude Code 承担修复与编排，让 Codex 只做 reviewer / verifier
- 需要沉淀 review / verify 产物，便于多轮闭环

## 输入参数

### Optional

- `BASE`: 基线分支，默认自动识别
- `GOAL`: 本轮修复目标
- `REVIEW_MODE`: `branch` / `staged` / `full`
- `OUTPUT_DIR`: 可选，review/verify artifact 输出目录
- `FIX_SCOPE`: 可选，修复选择策略；不改变脚本行为
- `INCLUDE_UNTRACKED_CONTENT`: 仅与 `REVIEW_MODE=full` 搭配；显式允许未跟踪文件内容进入 review/verify patch，且需通过大小、二进制、路径和 secret 检查

## 行为准则（Do/Don't）

### Do

- 先运行 review 脚本，再修复
- 优先处理 `必须修` 与高置信 `建议修`
- 完成后执行 checks 与 verify

### Don't

- 把低置信问题强行落地
- 做无关重构
- 伪造本地验证结果

## 详细执行步骤

1. 运行 `codex-review.sh`
2. 阅读 `.codex/codex-review-fix/latest-artifacts/review.md`
3. 修复高置信问题并补测试
4. 运行 `run-project-checks.sh --all --report-file .codex/codex-review-fix/latest-artifacts/checks.txt`
5. 运行 `codex-verify.sh --review-file .codex/codex-review-fix/latest-artifacts/review.md --checks-file .codex/codex-review-fix/latest-artifacts/checks.txt`
6. 输出闭环结论

## 输出规范

- 必须包含：已修复、未修复、本地验证、verify 结论、是否建议合并、剩余阻塞项。

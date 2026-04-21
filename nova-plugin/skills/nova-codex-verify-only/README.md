# Nova Codex Verify Only

`nova-codex-verify-only` 是 `nova-codex-review-fix` 闭环的「只 verify」变体，基于已有的 `review.md` 与可选的本地 checks 输出，驱动 Codex 做定向复验。

## 1. 能力简介

- 角色：Claude Code 作为编排者，Codex 作为 verifier
- 产物：`verify.md`（已解决 / 未解决 / 不确定 / 新增高风险）+ 是否建议合并
- 不做新的 review、不做 fix、不做 checks

## 2. 适用场景

- 上一轮修复完成，只需要对照 `review.md` 复验
- 经过多轮修复后，判断是否可合并
- 只想验证已知问题是否关闭，而不是再做一次开放式审查

## 3. 目录与脚本复用

本 skill 不包含脚本，复用 `nova-codex-review-fix` 的脚本与 prompt：

```text
nova-plugin/skills/
├── nova-codex-review-fix/
│   ├── scripts/codex-common.sh
│   ├── scripts/codex-verify.sh
│   └── prompts/codex-verify.prompt.md
└── nova-codex-verify-only/
    ├── SKILL.md
    └── README.md   ← 本文件
```

## 4. 前置依赖

- Git 仓库
- `codex` CLI 已登录并可 `codex --help`
- Bash 运行环境（macOS / Linux / WSL / Git Bash）
- 一份可读的 `review.md`（通常来自 `/codex-review-only` 或 `/codex-review-fix`）

## 5. Claude Code 使用方式

```text
/codex-verify-only REVIEW_FILE=.codex/codex-review-fix/latest-artifacts/review.md
/codex-verify-only REVIEW_FILE=<path> CHECKS_FILE=.codex/codex-review-fix/latest-artifacts/checks.txt
/codex-verify-only REVIEW_FILE=<path> CHECKS_FILE=<path> BASE=main
```

等价底层调用：

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh" \
  --review-file .codex/codex-review-fix/latest-artifacts/review.md \
  --checks-file .codex/codex-review-fix/latest-artifacts/checks.txt \
  --base main
```

## 6. 输出文件

```text
.codex/codex-review-fix/<timestamp>/
├── artifacts/
│   ├── branch.diff.patch
│   ├── git-status.txt
│   └── prompt.verify.md
└── verify.md
.codex/codex-review-fix/latest-artifacts/
└── verify.md
```

## 7. 输出内容要求

Claude Code 在 verify 完成后必须汇报：

- 已解决的条目
- 未解决 / 不确定 的条目及原因
- 新增高风险问题（若有）
- 是否建议合并
- 剩余阻塞项与下一步建议

## 8. 安全边界

- 不写业务代码
- 不做新的开放式 review；只对照 `review.md` 逐项核对
- 只在高置信时报告新增高风险问题

## 9. 常见问题

### `REVIEW_FILE` 缺失或不存在

- 先跑 `/codex-review-only` 生成 `review.md`
- 或从历史时间戳目录复制到 `latest-artifacts/review.md`

### `CHECKS_FILE` 可选但强烈建议

- 通过 `bash .../scripts/run-project-checks.sh --all --report-file <path>` 产生
- 带 checks 可让 verify 结论更可信

## 10. 与其他命令的关系

| 命令 | 行为 |
|---|---|
| `/codex-review-only` | 仅 review，产生 `review.md` |
| `/codex-verify-only` | 仅 verify（本 skill） |
| `/codex-review-fix` | review → fix → checks → verify 完整闭环 |

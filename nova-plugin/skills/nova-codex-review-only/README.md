# Nova Codex Review Only

`nova-codex-review-only` 是 `nova-codex-review-fix` 闭环的「只 review」变体，只驱动 Codex 生成结构化审查报告，不做任何代码修改。

## 1. 能力简介

- 角色：Claude Code 作为编排者，Codex 作为 reviewer
- 产物：`review.md` + `artifacts/`（diff、git status、最终 prompt 归档）
- 不触发 fix、不触发 verify，纯单步 review

## 2. 适用场景

- 提交前快速生成 review 报告，供人工阅读
- 把 review 与 fix 分为独立阶段，允许中间由人决定是否进入闭环
- 需要多仓库共用同一份 review 标准，但暂不希望自动修复

## 3. 目录与脚本复用

本 skill 本身不包含脚本，复用 `nova-codex-review-fix` 的脚本与 prompt：

```text
nova-plugin/skills/
├── nova-codex-review-fix/
│   ├── scripts/codex-common.sh
│   ├── scripts/codex-review.sh
│   └── prompts/codex-review.prompt.md
└── nova-codex-review-only/
    ├── SKILL.md
    └── README.md   ← 本文件
```

## 4. 前置依赖

- Git 仓库
- `codex` CLI 已登录并可 `codex --help`
- Bash 运行环境（macOS / Linux / WSL / Git Bash）

## 5. Claude Code 使用方式

```text
/codex-review-only                         # 默认 base 为自动识别
/codex-review-only BASE=main               # 指定 base
/codex-review-only BASE=main REVIEW_MODE=staged
```

等价底层调用：

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-review.sh" --base main
```

## 6. 输出文件

```text
.codex/codex-review-fix/<timestamp>/
├── artifacts/
│   ├── branch.diff.patch
│   ├── changed-files.txt
│   ├── git-status.txt
│   ├── prompt.review.md
│   └── review.scope.txt
└── review.md
.codex/codex-review-fix/latest-artifacts/
└── review.md
```

说明：输出目录沿用 `codex-review-fix` 的命名，保证后续可以无缝对接 `/codex-verify-only` 或完整 `/codex-review-fix` 闭环。

## 7. 安全边界

- 不写代码、不修改工作区任何非 `.codex/` 文件
- 不扩大审查范围
- 对低置信问题保持克制

## 8. 常见问题

### `codex: command not found`

- 安装 Codex CLI 并完成登录
- 重新打开终端，确认 `codex --help` 可执行

### `No diff found`

- 检查当前分支是否相对 base 有变更
- 使用 `--only-staged` 或 `--full` 扩展审查范围

## 9. 与其他命令的关系

| 命令 | 行为 |
|---|---|
| `/codex-review-only` | 仅 review（本 skill） |
| `/codex-verify-only` | 基于已有 `review.md` 做 verify |
| `/codex-review-fix` | review → fix → checks → verify 完整闭环 |

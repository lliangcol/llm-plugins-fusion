# Nova Codex Review Fix

`nova-codex-review-fix` 是一个面向 Claude Code / Codex 协作场景的半自动闭环能力包，用于把「Codex review -> Claude Code 修复 -> 本地检查 -> Codex verify」沉淀为可复用的 skill + 外部脚本组合。

## 1. 能力简介

- 角色分工清晰：
  - Codex：reviewer / verifier
  - Claude Code：fixer / orchestrator
  - Bash 脚本：上下文采集、命令桥接、产物落盘、检查汇总
- 产物标准化：`review.md`、`verify.md`、diff 工件、检查摘要
- 适合纳入插件市场型仓库，也便于后续拆成独立 skill 包或正式插件包

## 2. 适用场景

- 当前分支已经存在一批改动，需要先做审查再修复
- 需要把 review 结果沉淀成文件，便于二次 verify
- 希望用同一套流程约束多个仓库中的 AI 修复工作流
- 想让 Claude Code 只改代码，避免 Codex 直接写业务逻辑

## 3. 目录结构

```text
nova-plugin/skills/nova-codex-review-fix/
├── SKILL.md
├── README.md
├── prompts/
│   ├── claude-fix.prompt.md
│   ├── codex-review.prompt.md
│   └── codex-verify.prompt.md
└── scripts/
    ├── codex-common.sh
    ├── codex-review.sh
    ├── codex-verify.sh
    └── run-project-checks.sh
```

## 4. 前置依赖

- Git 仓库
- `codex` CLI，且已完成登录
- Bash 运行环境
  - macOS / Linux：直接使用系统 Bash
  - Win11：推荐在 WSL / Git Bash 中执行
- 本地项目依赖工具
  - Node 项目通常需要 `node` 与对应包管理器
  - 其他技术栈按仓库本身要求准备

## 5. Codex 环境要求

建议至少验证以下命令可用：

```bash
codex --help
codex exec --help
git status
```

脚本默认使用 `codex exec` 读取 prompt 模板与工件文件，不依赖交互式 TUI。

可选环境变量：

```bash
export CODEX_MODEL="gpt-5.4"
export CODEX_PROFILE="default"
```

## 6. Claude Code 使用方式

推荐通过命令或 skill 触发：

```text
/codex-review-fix BASE=main GOAL="修复当前分支直到可合并"
/codex-review-only BASE=main
/codex-verify-only REVIEW_FILE=.codex/codex-review-fix/latest-artifacts/review.md CHECKS_FILE=.codex/codex-review-fix/latest-artifacts/checks.txt
```

Claude Code 在使用主技能时应遵循：

1. 调 review 脚本生成报告
2. 仅读取高置信问题并修复
3. 运行本地检查
4. 调 verify 脚本复验
5. 输出闭环总结

## 7. 脚本说明

### `codex-common.sh`

- 提供日志、命令检查、Git 仓库检查、默认基线分支识别
- 提供输出目录、临时目录、路径解析、失败退出等公共能力

### `codex-review.sh`

- 生成 review 上下文工件
- 读取 `prompts/codex-review.prompt.md`
- 调 `codex exec` 输出 `review.md`

### `codex-verify.sh`

- 读取上一轮 `review.md`
- 生成 verify 上下文工件
- 读取 `prompts/codex-verify.prompt.md`
- 调 `codex exec` 输出 `verify.md`

### `run-project-checks.sh`

- 统一探测并执行仓库校验
- 优先复用现有 `lint` / `test` / `build` / repo checks
- 当前仓库会优先覆盖：
  - `scripts/verify-agents.sh`
  - `node scripts/validate-schemas.mjs`
  - `nova-plugin-command-generator` 的 `npm run lint/test/build`

## 8. 典型工作流示例

### 示例 A：完整闭环

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

### 示例 B：只做 review

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-review.sh" --only-staged
```

### 示例 C：已有 review 结果时只做 verify

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/nova-codex-review-fix/scripts/codex-verify.sh" \
  --review-file .codex/codex-review-fix/20260326-101500/review.md \
  --checks-file .codex/codex-review-fix/latest-artifacts/checks.txt
```

## 9. 输出文件说明

默认输出目录示例：

```text
.codex/codex-review-fix/20260326-101500/
├── artifacts/
│   ├── branch.diff.patch
│   ├── changed-files.txt
│   ├── git-status.txt
│   ├── prompt.review.md
│   └── review.scope.txt
├── review.md
└── verify.md
```

最近一次运行还会额外同步：

```text
.codex/codex-review-fix/latest-artifacts/
├── checks.txt
├── review.md
└── verify.md
```

- `artifacts/branch.diff.patch`：基于 base 或 staged/full 模式生成的 diff
- `artifacts/git-status.txt`：运行时工作区状态
- `artifacts/prompt.*.md`：脚本组合后的最终 prompt 归档
- `checks.txt`：本地 checks 输出，可供 verify 使用
- `review.md`：Codex 审查结果
- `verify.md`：Codex 复验结果
- 新一轮 review 成功同步后会清理 `latest-artifacts` 中旧的 `verify.md`，避免误读过期结论

## 10. 常见问题排查

### `codex: command not found`

- 安装 Codex CLI 并完成登录
- 重新打开终端，确认 `codex --help` 可执行

### `No diff found`

- 检查当前分支是否相对 base 有变更
- 若只想 review 暂存区，使用 `--only-staged`
- 若要包含工作区未提交改动，使用 `--full`

### `run-project-checks.sh` 没跑到预期脚本

- 先确认仓库脚本是否存在且本地依赖齐全
- Node 项目需要 `node` 与安装完成的依赖目录
- 可先单独执行被探测到的命令确认环境

## 11. Win11 + WSL 使用说明

- 推荐在 WSL Ubuntu 中执行 Bash 脚本
- 仓库路径若在 `D:` 盘，WSL 中通常对应 `/mnt/d/...`
- 若使用 Git Bash，也可直接运行脚本，但需自行确保 `codex`、`git`、`node` 在 PATH 中
- Windows PowerShell 默认不提供 Bash 语法校验环境，因此建议在 WSL / Git Bash 里运行 `bash -n`

## 12. 与当前仓库市场体系的集成方式

- 命令入口位于 `nova-plugin/commands/`
- Skill 入口位于 `nova-plugin/skills/`
- 用户文档位于 `nova-plugin/docs/`
- 命令生成器通过 `nova-plugin-command-generator/scripts/manifest-data.json` + `build-manifest.mjs` 接入
- 不新增独立 marketplace 插件，继续复用根目录 `.claude-plugin/marketplace.json` 的 `nova-plugin` 安装入口

## 13. 后续演进方向

- 为 `review.md` / `verify.md` 增加 JSON Schema 输出
- 增加针对 monorepo 的更细粒度 checks 选择
- 把脚本抽成正式插件包时，可补 `hooks`、`agents` 或更严格的策略配置
- 将输出目录中的 `latest` 软链接/副本做成更稳定的消费入口

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**LLM Plugins Fusion** 是一个面向 LLM 编程助手（如 Claude Code）的第三方插件市场。核心模块 `nova-plugin` 提供一套覆盖"探索→计划→实现→评审→收尾"全流程的命令体系，并新增 Codex review/fix/verify 半自动闭环能力，辅以 `nova-plugin-command-generator` React 工具 UI。

## 仓库结构

```
claude-plugins-fusion/
├── nova-plugin/                  # 主插件模块（版本由 .claude-plugin/plugin.json 管理）
│   ├── .claude-plugin/           # plugin.json（插件元数据）
│   ├── commands/                 # 20 个命令定义（含 3 个 Codex 闭环命令）
│   ├── agents/                   # 14 个专项 agent 定义
│   ├── skills/                   # 与命令 1:1 对应的技能文件夹（nova-*）
│   ├── docs/                     # 完整使用文档（中英双语）
│   └── hooks/                    # hooks.json（当前为空）
├── nova-plugin-command-generator/ # React 命令构建 UI（Vite + TypeScript）
├── .claude-plugin/               # marketplace.json（市场入口配置）
└── scripts/                      # verify-agents.sh / .ps1（验证 agent 数量 14-18）
```

## 开发命令

所有 npm 命令在 `nova-plugin-command-generator/` 目录下执行：

```bash
npm run dev        # 启动开发服务器（http://localhost:5173）
npm run build      # 生产构建
npm run lint       # ESLint（--max-warnings=0，零容忍）
npm run test       # Vitest 测试
npm run preview    # 预览生产构建
```

验证 agent 配置：

```bash
bash scripts/verify-agents.sh    # 验证 nova-plugin/agents/ 中 agent 数量（期望 14-18）
```

## 架构要点

### 插件发现机制
- 根目录的 `.claude-plugin/marketplace.json` 注册所有子插件
- `nova-plugin/.claude-plugin/plugin.json` 声明插件名称、版本、作者
- `nova-plugin/skills/` 下每个 `nova-*` 文件夹自动被 Claude Code 发现为 skill

### 命令体系（20 个命令）
| 阶段 | 命令 | 说明 |
|------|------|------|
| Explore | `senior-explore`, `explore`, `explore-lite`, `explore-review` | 理解与信息收集 |
| Plan | `plan-lite`, `plan-review`, `produce-plan`, `backend-plan` | 策略设计（backend-plan 专为 Java/Spring） |
| Review | `review`, `review-lite`, `review-only`, `review-strict`, `codex-review-only`, `codex-verify-only` | 代码质量审查 / Codex 复验 |
| Implement | `implement-plan`, `implement-standard`, `implement-lite`, `codex-review-fix` | 执行，严格程度递减 / Codex 闭环修复 |
| Finalize | `finalize-work`, `finalize-lite` | 交付与收尾 |

`/explore` 和 `/review` 是统一入口 hub，通过 `PERSPECTIVE` / `LEVEL` 参数路由到子命令。

### Agent 路由模式
`orchestrator` agent 负责将任务分发给专项 agent（api-design、java-backend-engineer、quality-engineer 等）。每个 agent 使用特定工具子集（Read/Glob/Grep/Bash 等）。

### nova-plugin-command-generator 结构
- `src/data/manifest.ts` — 命令定义与工作流配置的数据源
- `src/store/` — 草稿、指导状态、历史记录（基于 localStorage）
- `src/utils/render.ts` — 模板变量替换逻辑
- `src/App.tsx` — 主组件（多 Tab：场景、命令、生成器、工作流、历史）

## 版本管理
插件版本在 `nova-plugin/.claude-plugin/plugin.json` 的 `version` 字段中维护。更新命令或 agent 后同步递增版本号。

## 关键约束
- ESLint 配置为零警告容忍（`--max-warnings=0`），包含 a11y 无障碍规则
- TypeScript 使用严格模式（`strict: true`，`noEmit: true`）
- agent 数量需保持在 14-18 个范围内（由 verify-agents 脚本检验）
- 附件大小限制：每个文件最大 200KB（command-generator 中的约束）

# 第一章：项目概览与架构基线

## 1.1 基本信息

| 字段 | 值 |
|------|----|
| 项目名称 | claude-plugins-fusion（LLM Plugins Fusion） |
| 仓库路径 | `d:/Projects/claude-plugins-fusion/` |
| 主插件版本 | nova-plugin **1.0.6**（`nova-plugin/.claude-plugin/plugin.json`） |
| UI 工具版本 | nova-plugin-command-generator **0.1.0**（`nova-plugin-command-generator/package.json`） |
| 作者 | liu liang |
| 许可证 | MIT（2026 年） |
| 审计日期 | 2026-03-18 |
| 整改完成 | 2026-03-18 |
| 最近提交 | `542172d Add Skills`（2026-02-12，审计基线）|

---

## 1.2 产品定位

**claude-plugins-fusion** 是一个面向 Claude Code 用户的**第三方插件市场**，采用双层架构：

- **marketplace 层**（`.claude-plugin/marketplace.json`）：插件注册中心，目前仅注册 nova-plugin 1 个插件。
- **plugin 层**（`nova-plugin/`）：唯一正式插件，提供覆盖"探索 → 规划 → 评审 → 实现 → 收尾"五阶段的开发工作流命令体系。

辅助工具 **nova-plugin-command-generator**（`nova-plugin-command-generator/`）是一个独立 React SPA，提供可视化命令构建界面，不被 Claude Code 加载为插件，通过浏览器访问独立使用。

---

## 1.3 仓库实测规模数据

| 分类 | 审计时数量 | 整改后数量 | 位置 |
|------|-----------|-----------|------|
| 活跃 Agents | 14 | 14 | `nova-plugin/agents/*.md` |
| 命令定义 | 17 | 17（已统一 frontmatter）| `nova-plugin/commands/*.md` |
| Skills | 17（与命令 1:1） | 17 | `nova-plugin/skills/nova-*/SKILL.md` |
| 归档 Agents | 若干（legacy） | 保留，已加 NOTICE.md | `.claude/agents/archive/` |
| 文档文件 | 50+ | 55+（新增 5 篇）| `nova-plugin/docs/` |
| 测试文件 | **1**（5 用例）| **4**（36 用例）| `nova-plugin-command-generator/tests/` |
| CI 配置文件 | **0** | **2**（ci.yml + release.yml）| `.github/workflows/` |
| hooks 定义 | **0**（文件存在但为空）| **2 个 hook** | `nova-plugin/hooks/hooks.json` |
| JSON Schema | **0** | **2**（plugin + marketplace）| `schemas/` |
| App.tsx 行数 | **1690 行** | **1322 行** | `src/App.tsx` |
| App.tsx 行数 | **1690 行** | `nova-plugin-command-generator/src/App.tsx` |
| manifest.ts 行数 | 393 行 | `nova-plugin-command-generator/src/data/manifest.ts` |

---

## 1.4 技术栈

### nova-plugin（插件本体）
- **实现方式**：纯 Markdown + JSON，**零运行时依赖**
- **配置格式**：`plugin.json`（元数据）、`hooks.json`（生命周期钩子，当前为空）
- **命令格式**：Markdown 文件，包含完整 prompt 模板，由 Claude Code 直接加载
- **Skill 格式**：YAML frontmatter + 内容体，Claude Code 自动扫描 `nova-*/` 目录

### nova-plugin-command-generator（辅助 UI）
- **框架**：React 18.2 + TypeScript 5.3
- **构建**：Vite 7.3（`npm run dev` 启动 localhost:5173）
- **测试**：Vitest 3.2
- **Lint**：ESLint 8.57，`--max-warnings=0`（零容忍模式）
- **状态持久化**：localStorage（草稿、历史记录、指导状态）
- **附件限制**：每个文件最大 200KB，截断至 2000 字符

---

## 1.5 架构边界

```
marketplace 层
└── .claude-plugin/marketplace.json          ← 注册插件列表（当前仅 nova-plugin）

    plugin 层
    └── nova-plugin/
        ├── .claude-plugin/plugin.json        ← 插件元数据（name/version/author）
        ├── agents/                           ← 14 个专项 Agent（.md 定义）
        │   ├── orchestrator.md               ← 路由协调（Read/Glob/Grep，无 Write）
        │   ├── java-backend-engineer.md      ← 代码实现（Read/Write/Edit/Bash/Glob/Grep）
        │   └── ...（12 个其他专项 Agent）
        ├── commands/                         ← 17 个命令（Claude Code /command 触发）
        │   ├── explore.md / senior-explore.md / ...
        │   ├── plan-lite.md / produce-plan.md / ...
        │   ├── review.md / review-strict.md / ...
        │   ├── implement-plan.md / implement-lite.md / ...
        │   └── finalize-work.md / finalize-lite.md
        ├── skills/                           ← 17 个 Skills（与命令 1:1）
        │   └── nova-*/SKILL.md               ← YAML frontmatter 元数据
        ├── hooks/
        │   └── hooks.json                    ← {"hooks":{}} 当前完全空
        └── docs/                             ← 50+ 文档（中英双语）

    独立工具（不被 Claude Code 加载）
    └── nova-plugin-command-generator/        ← React SPA，可视化命令构建
        ├── src/data/manifest.ts              ← commands/ 的硬编码数据副本 ⚠️
        └── src/App.tsx                       ← 1690 行巨型组件 ⚠️
```

---

## 1.6 命令体系（17 个命令，五阶段）

| 阶段 | 命令 | Hub 路由 | 破坏性操作 |
|------|------|---------|----------|
| **探索** | `senior-explore`, `explore`(hub), `explore-lite`, `explore-review` | `PERSPECTIVE` 参数 | none / low |
| **规划** | `plan-lite`, `plan-review`, `produce-plan`, `backend-plan` | — | none / low |
| **评审** | `review`(hub), `review-lite`, `review-only`, `review-strict` | `LEVEL` 参数 | none |
| **实现** | `implement-plan`, `implement-standard`, `implement-lite` | — | medium |
| **收尾** | `finalize-work`, `finalize-lite` | — | none |

`implement-*` 系列命令需 `PLAN_APPROVED=true` 环境变量门控，防止未经计划的代码修改。

---

## 1.7 Agent 权限分布

| Agent 类型 | 代表 Agent | 工具权限 | 设计意图 |
|-----------|-----------|---------|---------|
| 只读分析 | orchestrator, data-analytics, db-engineer, incident-responder, security-audit, security-engineer | Read, Bash, Glob, Grep | 分析/路由，不修改文件 |
| 读写实现 | java-backend-engineer, api-design, quality-engineer, test-automator, devops-platform, git-release-manager, build-deps, refactoring-specialist | Read, Write, Edit, Bash, Glob, Grep | 代码实现/修复 |

**安全评价**：权限划分符合最小权限原则。安全审计、事件响应、数据分析等只读 Agent 被正确约束，无写权限。

---

## 1.8 成熟度判断

| 维度 | 评级 | 说明 |
|------|------|------|
| 产品功能完整性 | ★★★★☆ | 命令体系完整，文档齐全，核心流程可用 |
| 工程化成熟度 | ★★☆☆☆ | 测试几乎空白，无 CI/CD，hooks 未实现 |
| 架构清晰度 | ★★★★☆ | plugin/command/skill 分层清晰，Agent 职责明确 |
| 可维护性 | ★★★☆☆ | 文档好但存在双轨维护风险，App.tsx 过重 |
| 安全性 | ★★★★★ | 无安全漏洞，权限控制严格，无硬编码密钥 |

**总体评价**：产品功能和设计理念是项目的最强项，工程化基础是最需要补强的短板。

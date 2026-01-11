中文 | [English](nova-plugin/docs/README.en.md)

<div align="center">

# Claude Plugins Fusion

**Claude Code 插件市场与插件集合**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-purple.svg)](https://claude.ai)

</div>

---

## 📖 项目简介

**Claude Plugins Fusion** 是一个用于管理 Claude Code 插件市场与插件集合的仓库。通过本仓库，你可以：

- 🎯 **一键安装** — 快速将插件集成到 Claude Code
- 🔧 **工程化开发** — 提供完整的开发工作流命令
- 📚 **丰富文档** — 详尽的使用手册和示例库
- 🔄 **持续扩展** — 支持添加新插件和功能

---

## 🚀 快速开始

### 第一步：添加市场

在 Claude Code 中执行：

```bash
/plugin marketplace add <github-username>/claude-plugins-fusion
```

### 第二步：安装插件

```bash
claude plugin install nova-plugin@claude-plugins-fusion
```

### 第三步：开始使用

```bash
# 查看已安装插件
/plugin

# 使用命令
/senior-explore 分析当前项目
```

> 💡 **提示**：安装后即可使用所有 15 个开发工作流命令

---

## 📁 仓库结构

```
claude-plugins-fusion/
│
├── 📄 .claude-plugin/
│   └── marketplace.json              ← 市场入口配置
│
├── 📦 nova-plugin/                    ← 插件目录
│   ├── 📄 .claude-plugin/
│   │   └── plugin.json               ← 插件元信息
│   │
│   ├── 📂 commands/                   ← 15 个命令预设
│   │   ├── senior-explore.md
│   │   ├── explore-lite.md
│   │   ├── explore-review.md
│   │   ├── plan-lite.md
│   │   ├── produce-plan.md
│   │   ├── backend-plan.md
│   │   ├── plan-review.md
│   │   ├── review-lite.md
│   │   ├── review-only.md
│   │   ├── review-strict.md
│   │   ├── implement-plan.md
│   │   ├── implement-standard.md
│   │   ├── implement-lite.md
│   │   ├── finalize-work.md
│   │   └── finalize-lite.md
│   │
│   ├── 📂 docs/                       ← 文档
│   │   ├── commands-reference-guide.md
│   │   └── claude-code-commands-handbook.md
│   │
│   ├── 📂 hooks/                      ← Hooks 配置
│   ├── 📂 agents/                     ← 代理模板 (待扩展)
│   ├── 📂 config/                     ← 配置文件 (待扩展)
│   ├── 📂 output-styles/              ← 输出风格 (待扩展)
│   ├── 📂 scripts/                    ← 脚本 (待扩展)
│   └── 📂 skills/                     ← 技能包 (待扩展)
│
└── 📄 README.md
```

---

## 🔌 插件：nova-plugin

<table>
<tr>
<td width="120"><strong>版本</strong></td>
<td>1.0.0</td>
</tr>
<tr>
<td><strong>作者</strong></td>
<td>liu liang</td>
</tr>
<tr>
<td><strong>命令数</strong></td>
<td>15 个</td>
</tr>
<tr>
<td><strong>定位</strong></td>
<td>开发效率增强插件</td>
</tr>
</table>

### 🎯 核心能力

专为 Claude Code 设计的开发效率增强插件，覆盖完整开发工作流：

### 开发工作流

| 阶段 | 探索 🔍 | 规划 📐 | 评审 🔎 | 实现 ⚙️ | 收尾 📦 |
|------|--------|--------|--------|--------|--------|
| 目标 | 理解问题 | 制定方案 | 审查质量 | 编写代码 | 交付成果 |
| 命令数 | 3 个命令 | 4 个命令 | 3 个命令 | 3 个命令 | 2 个命令 |

---

### 📚 文档导航

| 📄 文档 | 📝 说明 | 🎯 适用场景 |
|--------|--------|-----------|
| [📘 命令完全参考手册](nova-plugin/docs/commands-reference-guide.md) | 详细参数、35+ 场景示例、工作流模板 | **日常查阅、复制模板** |
| [📗 命令使用手册](nova-plugin/docs/claude-code-commands-handbook.md) | 按类型组织、命令对比表 | **快速入门、命令选择** |

<details>
<summary>📊 <strong>两份文档对比</strong>（点击展开）</summary>

| 维度 | 完全参考手册 | 使用手册 |
|------|-------------|---------|
| **定位** | 日常查阅、复制模板 | 快速入门、命令选择 |
| **示例数量** | 35+ | 15+ |
| **参数说明** | 详细表格 | 简要说明 |
| **工作流** | 4 个完整模板 | 3 个简要流程 |
| **图表** | ASCII 流程图 | 表格为主 |

**使用建议**：
1. 🆕 **新用户** → 先看使用手册了解命令体系
2. 📋 **日常使用** → 用完全参考手册检索场景、复制示例
3. 🔄 **工作流** → 参考完全参考手册的工作流模板库

</details>

---

### 📋 命令速查表

#### 🔍 探索类 — 理解问题，不做实现

| 命令 | 约束 | 说明 | 查看定义 |
|------|:----:|------|---------|
| `/senior-explore` | 🔴 强 | 资深视角深度分析，暴露风险与未知 | [📄](nova-plugin/commands/senior-explore.md) |
| `/explore-lite` | 🟡 中 | 快速对齐理解，轻量认知同步 | [📄](nova-plugin/commands/explore-lite.md) |
| `/explore-review` | 🟡 中 | Reviewer 视角质询，生成问题清单 | [📄](nova-plugin/commands/explore-review.md) |

#### 📐 规划类 — 制定方案，不写代码

| 命令 | 约束 | 说明 | 查看定义 |
|------|:----:|------|---------|
| `/plan-lite` | 🟡 中 | 轻量执行计划，快速对齐 | [📄](nova-plugin/commands/plan-lite.md) |
| `/produce-plan` | 🔴 强 | 正式设计文档，写入文件 | [📄](nova-plugin/commands/produce-plan.md) |
| `/backend-plan` | 🔴 强 | Java/Spring 后端专项设计 | [📄](nova-plugin/commands/backend-plan.md) |
| `/plan-review` | 🟡 中 | 计划文档质量评审 | [📄](nova-plugin/commands/plan-review.md) |

#### 🔎 评审类 — 审查质量，不写代码

| 命令 | 约束 | 说明 | 查看定义 |
|------|:----:|------|---------|
| `/review-lite` | 🟢 弱 | 轻量评审，日常 PR 反馈 | [📄](nova-plugin/commands/review-lite.md) |
| `/review-only` | 🟡 中 | 常规严格评审，按级别分类 | [📄](nova-plugin/commands/review-only.md) |
| `/review-strict` | 🔴 强 | 穷尽式审计，高风险代码 | [📄](nova-plugin/commands/review-strict.md) |

#### ⚙️ 实现类 — 编写代码

| 命令 | 约束 | 说明 | 查看定义 |
|------|:----:|------|---------|
| `/implement-plan` | 🔴 强 | 严格按批准计划执行 | [📄](nova-plugin/commands/implement-plan.md) |
| `/implement-standard` | 🟡 中 | 标准受控实现，允许小纠错 | [📄](nova-plugin/commands/implement-standard.md) |
| `/implement-lite` | 🟢 弱 | 快速实现，允许小重构 | [📄](nova-plugin/commands/implement-lite.md) |

#### 📦 收尾类 — 交付成果，不改代码

| 命令 | 约束 | 说明 | 查看定义 |
|------|:----:|------|---------|
| `/finalize-work` | 🔴 强 | 完整交付物，commit + PR | [📄](nova-plugin/commands/finalize-work.md) |
| `/finalize-lite` | 🟢 弱 | 极简总结，三要素 | [📄](nova-plugin/commands/finalize-lite.md) |

> **约束说明**：🔴 强约束 = 严格规则 | 🟡 中约束 = 有边界 | 🟢 弱约束 = 灵活执行

---

### 💡 使用示例

#### 场景一：新功能开发

```bash
# 1️⃣ 探索需求
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT: 实现用户积分转赠功能
DEPTH: normal

# 2️⃣ 制定计划
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/points-transfer.md
PLAN_INTENT: 实现积分转赠功能

# 3️⃣ 执行实现
/implement-plan
PLAN_INPUT_PATH: docs/plans/points-transfer.md
PLAN_APPROVED: true

# 4️⃣ 收尾交付
/finalize-work
```

#### 场景二：线上问题修复

```bash
# 1️⃣ 深度排查
/senior-explore
INTENT: Investigate a production issue
CONTEXT: 支付回调重复处理问题
DEPTH: deep

# 2️⃣ 快速修复
/implement-standard
按以下步骤修复: ...

# 3️⃣ 严格审查
/review-strict

# 4️⃣ 交付
/finalize-work
```

#### 场景三：日常 PR 评审

```bash
# 根据风险级别选择
/review-lite    # 小改动
/review-only    # 核心逻辑
/review-strict  # 高风险代码
```

---

## 🛠️ 开发指南

### 添加新插件

```
1. 创建目录    →  <plugin-name>/
2. 添加元信息  →  <plugin-name>/.claude-plugin/plugin.json
3. 添加内容    →  commands/、agents/、skills/ 等
4. 注册插件    →  在 marketplace.json 中添加条目
```

### 配置文件示例

<details>
<summary>📄 <strong>plugin.json</strong>（点击展开）</summary>

```json
{
    "name": "my-plugin",
    "description": "插件描述",
    "version": "1.0.0",
    "author": {
        "name": "作者名"
    }
}
```

</details>

<details>
<summary>📄 <strong>marketplace.json</strong>（点击展开）</summary>

```json
{
    "name": "claude-plugins-fusion",
    "owner": {
        "name": "liu liang"
    },
    "metadata": {
        "description": "A curated marketplace of Claude Code plugins"
    },
    "plugins": [
        {
            "name": "nova-plugin",
            "source": "./nova-plugin",
            "version": "1.0.0",
            "author": {
                "name": "liu liang"
            },
            "description": "开发效率增强插件"
        }
    ]
}
```

</details>

### 命令文件格式

命令文件为 **Markdown 格式**，放置于 `commands/` 目录：

- 文件名即命令名：`review-lite.md` → `/review-lite`
- 支持变量占位符：`$ARGUMENTS`、`$PLAN_OUTPUT_PATH` 等
- 支持结构化输入/输出定义

---

## 📖 参考资料

| 资源 | 说明 |
|-----|------|
| [Claude Code 插件官方文档](https://code.claude.com/docs/zh-CN/discover-plugins) | 官方插件开发指南 |
| [命令完全参考手册](nova-plugin/docs/commands-reference-guide.md) | 本插件详细使用指南 |
| [命令使用手册](nova-plugin/docs/claude-code-commands-handbook.md) | 本插件快速入门指南 |

---

<div align="center">

**Made with ❤️ for Claude Code**

[🔝 回到顶部](#claude-plugins-fusion)

</div>

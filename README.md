中文 | [English](nova-plugin/docs/README.en.md)

<div align="center">

# LLM Plugins Fusion

**第三方 LLM 插件市场与插件集合**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com)

</div>

---

## 📖 项目简介

**LLM Plugins Fusion** 是面向 LLM 编码助手（如 Claude Code）的第三方插件市场与插件集合仓库。通过本仓库，你可以：

- 🎯 **一键安装**：快速将插件集成到 Claude Code
- 🔧 **工程化开发**：提供完整的开发工作流命令
- 📚 **完善文档**：详尽的使用手册和示例
- 🔄 **持续扩展**：支持添加新插件和功能

---

## 🚀 快速开始

### 第一步：添加市场

在 Claude Code 中执行：

```bash
/plugin marketplace add lliangcol/llm-plugins-fusion
```

### 第二步：安装插件

```bash
/plugin install nova-plugin@llm-plugins-fusion
```

### 第三步：开始使用

```bash
# 查看已安装插件
/plugin

# 使用命令
/senior-explore 分析当前项目
```

---

## 📁 仓库结构

```
llm-plugins-fusion/
├── 📄 .claude-plugin/
│   └── marketplace.json              # 市场入口配置
├── 📦 nova-plugin/                    # 插件目录
│   ├── 📄 .claude-plugin/
│   │   └── plugin.json               # 插件元信息
│   ├── 📂 commands/                   # 17 个命令预设（15 个原有 + 2 个统一命令）
│   │   ├── senior-explore.md
│   │   ├── ⭐ explore.md          # 统一探索命令（新增）
│   │   ├── explore-lite.md
│   │   ├── explore-review.md
│   │   ├── plan-lite.md
│   │   ├── produce-plan.md
│   │   ├── backend-plan.md
│   │   ├── plan-review.md
│   │   ├── review-lite.md
│   │   ├── ⭐ review.md           # 统一评审命令（新增）
│   │   ├── review-only.md
│   │   ├── review-strict.md
│   │   ├── implement-plan.md
│   │   ├── implement-standard.md
│   │   ├── implement-lite.md
│   │   ├── finalize-work.md
│   │   └── finalize-lite.md
│   ├── 📂 docs/                       # 文档
│   │   ├── commands-reference-guide.md
│   │   ├── claude-code-commands-handbook.md
│   │   ├── agents-summary.md
│   │   └── agents-summary.en.md
│   ├── 📂 hooks/                      # Hooks 配置
│   ├── 📂 agents/                     # 子代理定义
│   ├── 📂 config/                     # 配置文件
│   ├── 📂 output-styles/              # 输出风格
│   ├── 📂 scripts/                    # 脚本
│   └── 📂 skills/                     # 技能包
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
<td>17（15 个原有 + 2 个新增统一命令）</td>
</tr>
<tr>
<td><strong>定位</strong></td>
<td>开发效率增强工作流插件</td>
</tr>
</table>

### 🎯 核心能力

面向 LLM 编码助手（兼容 Claude Code）的开发效率增强插件，覆盖完整开发工作流。

### 开发工作流

| 阶段     | 探索 🔍       | 规划 📝  | 评审 🔎      | 实现 ⚙️  | 收尾 📦  |
| -------- | ------------- | -------- | ------------ | -------- | -------- |
| 目标     | 理解问题      | 制定方案 | 审查质量     | 编写代码 | 交付成果 |
| 命令数   | 4 个命令      | 4 个命令 | 4 个命令     | 3 个命令 | 2 个命令 |
| 统一命令 | ⭐ `/explore` | -        | ⭐ `/review` | -        | -        |

---

## 🧠 Agents 子代理

Active agents: 14（默认扫描：`nova-plugin/agents/`）。Legacy agents: 69（已归档：`.claude/agents/archive/nova-plugin/agents/`，迁移清单见 `docs/agents/MIGRATION_MANIFEST.md`）。

- 路由与使用：`docs/agents/ROUTING.md`
- Legacy 汇总（保留作参考）：`nova-plugin/docs/agents-summary.md` / `nova-plugin/docs/agents-summary.en.md`

---

## 📚 文档导航

| 📄 文档                                                              | 📝 说明                              | 🎯 适用场景            |
| -------------------------------------------------------------------- | ------------------------------------ | ---------------------- |
| [📘 命令完全参考手册](nova-plugin/docs/commands-reference-guide.md)  | 详细参数、5+ 场景示例、工作流模板    | **日常查询、复制模板** |
| [📗 命令使用手册](nova-plugin/docs/claude-code-commands-handbook.md) | 按类型组织、命令对比表               | **快速入门、命令选择** |
| [🧭 Agents 路由指南](docs/agents/ROUTING.md)                         | Active agents 列表、关键词路由、示例 | **自动路由、选 agent** |
| [🧠 Agents 子代理说明](nova-plugin/docs/agents-summary.md)           | 子代理角色、工具、场景汇总           | **了解与选择子代理**   |

如需英文文档，请见 `nova-plugin/docs/README.en.md` 与 `nova-plugin/docs/agents-summary.en.md`。

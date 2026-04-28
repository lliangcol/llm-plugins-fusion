# 双轨设计说明：Commands 与 Skills

## 为什么有两份文件？

nova-plugin 为每个命令维护两种形式：

- `nova-plugin/commands/*.md` — **命令文件**（面向用户直接触发）
- `nova-plugin/skills/nova-*/SKILL.md` — **技能文件**（面向 Claude Code 自动调用）

---

## Commands：用户触发的完整 Prompt

**位置：** `nova-plugin/commands/*.md`

**用途：** 每个命令文件是一段完整的 prompt 指令，用户通过 Claude Code 的斜杠命令（如 `/nova-explore`）直接触发。文件内容就是发送给 Claude 的完整上下文，包含：

- 命令目标与约束规则
- 详细的执行步骤说明
- 输出格式要求
- 禁止行为清单

**特点：**
- 内容完整、可读性强，面向开发者阅读
- 不依赖 Claude Code 的技能发现机制
- 可独立使用（复制内容粘贴给任意 AI 也能工作）

---

## Skills：结构化技能元数据

**位置：** `nova-plugin/skills/nova-*/SKILL.md`

**用途：** 每个技能文件遵循 Claude Code 官方 [Agent Skills](https://agentskills.io) 标准，包含 YAML frontmatter 元数据和精简指令。Claude Code 会：

1. 在会话启动时自动发现所有 `nova-*` 技能
2. 根据 `description` 字段判断何时自动调用
3. 允许通过 `orchestrator` agent 路由到对应技能

**官方支持的 frontmatter 字段：**

| 字段 | 作用 |
|------|------|
| `name` | 技能名称（创建 `/name` 斜杠命令） |
| `description` | Claude 据此决定何时激活 |
| `allowed-tools` | 限制可用工具 |
| `disable-model-invocation` | 阻止 Claude 自动调用 |
| `user-invocable` | 是否出现在 `/` 菜单 |
| `model` | 指定使用的模型 |
| `context` | 设为 `fork` 在子 agent 中运行 |

---

## 两者关系：互补不重复

```
用户手动触发        Claude 自动调用
     │                    │
     ▼                    ▼
commands/*.md       skills/nova-*/SKILL.md
（完整 prompt）      （结构化元数据 + 精简指令）
     │                    │
     └────────────────────┘
           共同目标：
       正确引导 Claude 完成
       当前阶段的开发任务
```

- Commands 文件内容**详尽**，适合作为权威文档参考
- Skills 文件内容**精简**，适合被 orchestrator 批量加载
- 两者描述的是**同一套命令体系**，保持语义一致

---

## 新增能力时的双轨维护规范

新增或修改一个命令时，需要同步更新两处：

### 1. 修改 `nova-plugin/commands/<name>.md`

- 更新完整 prompt 内容
- 在文件顶部添加/更新 YAML frontmatter：

```yaml
---
id: <command-id>
stage: <explore|plan|review|implement|finalize>
title: <显示名称>
destructive-actions: <none|low|medium|high>
allowed-tools: Read Glob Grep LS
invokes:
  skill: nova-<command-id>
---
```

### 2. 修改 `nova-plugin/skills/nova-<name>/SKILL.md`

- 保持 `name`、`description` 与命令文件语义一致
- 根据命令特性设置 `allowed-tools` 与 `metadata.novaPlugin.*`

### 3. 运行校验

- `node scripts/lint-frontmatter.mjs`
- `node scripts/validate-schemas.mjs`（如修改 marketplace 或 plugin metadata）
- `bash scripts/verify-agents.sh` 或 `.\scripts\verify-agents.ps1`（如修改 active agents）

### 4. 更新版本号

- 修改 `nova-plugin/.claude-plugin/plugin.json` 的 `version` 字段

---

## 为什么不合并为一份？

| 需求 | Commands | Skills |
|------|----------|--------|
| 完整可读的文档 | ✅ | ❌（过于精简） |
| Claude Code 自动发现 | ❌（不在 skills/ 下） | ✅ |
| 支持 orchestrator 路由 | 间接（通过 Skills） | ✅ 直接 |
| 用户可直接阅读理解 | ✅ | 需要熟悉 frontmatter |
| 版本控制与追溯 | ✅ | ✅ |

两种形式各有所长，双轨维护是在"完整文档"与"机器可读元数据"之间的合理权衡。

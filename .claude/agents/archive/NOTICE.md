# 归档说明

本目录（`archive/`）保存的是早期版本的 agent 分类结构，**当前已不再维护**。

## 状态

| 路径 | 说明 |
|------|------|
| `archive/nova-plugin/agents/` | 旧版按领域分组的 agent 文件（共 69 个） |
| `.claude/agents/active/` | 预留占位目录，不是当前 active agent 存放目录 |

## 当前活跃 agents

活跃的 agent 定义位于：

```
nova-plugin/agents/          ← 当前使用（14 个 agent .md 文件）
```

`.claude/agents/active/` 仅作为预留占位目录保留；当前仓库的 active agent
定义以 `nova-plugin/agents/` 为准，并由 `scripts/verify-agents.sh` 和
`scripts/verify-agents.ps1` 校验。

## 为什么保留此目录

- 提供历史版本参考，便于查阅早期设计决策
- 避免直接删除导致 git 历史丢失

> **注意：** 请勿将本目录中的文件作为活跃 agent 引用。如需恢复某个 agent，请将其迁移到 `nova-plugin/agents/` 并更新 `scripts/verify-agents.sh` 计数。

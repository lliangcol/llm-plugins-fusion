# 归档说明

本目录（`archive/`）保存的是早期版本的 agent 分类结构，**当前已不再维护**。

## 状态

| 路径 | 说明 |
|------|------|
| `archive/nova-plugin/agents/` | 旧版按领域分组的 agent 文件（共 69 个） |

## 当前活跃 agents

活跃的 agent 定义位于：

```
nova-plugin/agents/          ← 当前使用（14 个 agent .md 文件）
.claude/agents/active/       ← .claude 本地 agent 配置
```

## 为什么保留此目录

- 提供历史版本参考，便于查阅早期设计决策
- 避免直接删除导致 git 历史丢失

> **注意：** 请勿将本目录中的文件作为活跃 agent 引用。如需恢复某个 agent，请将其迁移到 `nova-plugin/agents/` 并更新 `scripts/verify-agents.sh` 计数。

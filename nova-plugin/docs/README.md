# nova-plugin 文档索引

此目录按文档用途和工作流阶段组织，优先从下面的入口进入。

## 快速入口

| 分类 | 路径 | 内容 |
| --- | --- | --- |
| 项目概览 | [overview/](overview/) | 英文项目 README |
| 使用手册 | [guides/](guides/) | 命令参考、命令使用手册 |
| 命令文档 | [commands/](commands/) | 每个命令的详细说明与中英文 README |
| Agents | [agents/](agents/) | 子代理角色汇总 |
| 架构与设计 | [architecture/](architecture/) | hooks、双轨设计、优化总结 |

## 命令文档

| 阶段 | 路径 | 命令 |
| --- | --- | --- |
| Explore | [commands/explore/](commands/explore/) | `explore`, `explore-lite`, `explore-review`, `senior-explore` |
| Plan | [commands/plan/](commands/plan/) | `plan-lite`, `plan-review`, `produce-plan`, `backend-plan` |
| Review | [commands/review/](commands/review/) | `review`, `review-lite`, `review-only`, `review-strict` |
| Implement | [commands/implement/](commands/implement/) | `implement-lite`, `implement-plan`, `implement-standard` |
| Finalize | [commands/finalize/](commands/finalize/) | `finalize-lite`, `finalize-work` |
| Codex | [commands/codex/](commands/codex/) | `codex-review-fix`, `codex-review-only`, `codex-verify-only` |

## 常用文档

- [命令完全参考手册](guides/commands-reference-guide.md)
- [命令使用手册](guides/claude-code-commands-handbook.md)
- [Codex 闭环说明](commands/codex/codex-review-fix.README.md)
- [Agents 子代理说明](agents/agents-summary.md)
- [English overview](overview/README.en.md)

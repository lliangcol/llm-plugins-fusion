# /nova-plugin:route

- 来源：`nova-plugin/commands/route.md`

## 命令定位

- 只读第一阶段路由入口，帮助选择下一步 nova command、skill、core agent 和 capability packs。
- 适用：需求或任务较模糊、不确定该从哪个命令开始、或在非 Claude Code 工具中消费 nova skills。
- 不该用于：直接实现、写计划、运行校验或创建 artifact。

## 参数说明

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `REQUEST` | Yes | 用户请求、任务摘要、issue、diff 上下文或工作流意图 | `修复 CI 失败并补文档` |
| `CONTEXT` | No | 可选上下文 | `当前分支、计划文件、diff 摘要` |
| `DEPTH` | No | `normal` / `brief`，默认 `normal` | `brief` |

## 完整示例

```text
/nova-plugin:route
这个任务涉及 README、marketplace metadata 和 release evidence，我应该从哪个 nova 命令开始？
```

```text
/nova-plugin:route CONTEXT="Cursor 消费 nova skills"
用户让我实现一个中等风险功能，但没有批准的 plan。
```

## 与相近命令的对比

- `/nova-plugin:explore` 负责理解事实、未知点和风险，不选择完整工作流路线。
- `/nova-plugin:produce-plan` 负责写正式计划，需要更明确的计划意图和输出路径。
- `/nova-plugin:route` 只选择下一步命令和输入要求，不替代计划、评审或实现。

## 路由家族

| 意图 | 默认路线 |
| --- | --- |
| 理解事实、风险、未知点 | `/nova-plugin:explore` 或 `/nova-plugin:senior-explore` |
| 生成计划或设计 | `/nova-plugin:produce-plan`、`/nova-plugin:plan-lite` 或 `/nova-plugin:backend-plan` |
| 审查代码、计划或风险 | `/nova-plugin:review`、`/nova-plugin:plan-review`、`/nova-plugin:codex-review-only` 或 `/nova-plugin:codex-verify-only` |
| 修改项目文件 | `/nova-plugin:implement-plan`、`/nova-plugin:implement-standard` 或 `/nova-plugin:implement-lite` |
| 交付总结或发布说明 | `/nova-plugin:finalize-work` 或 `/nova-plugin:finalize-lite` |
| Codex review/fix/verify 闭环 | `/nova-plugin:codex-review-fix`、`/nova-plugin:codex-review-only` 或 `/nova-plugin:codex-verify-only` |

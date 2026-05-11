# Skill: /route

- 来源：`nova-plugin/commands/route.md`

## 用途

`/route` 是只读第一阶段工作流路由入口，用于在开始工作前选择下一步 `nova-plugin` 命令、skill、core agent、capability packs、必需输入和验证路径。

它先把请求归类为 Explore、Plan、Review、Implement、Finalize 或 Codex loop，再推荐一个最小可执行的下一步；只有跨阶段任务才输出短序列。

## 参数

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `REQUEST` | Yes | 用户请求、任务摘要、issue、diff 上下文或不明确的工作流意图 | `我要修复这个 PR 的安全问题` |
| `CONTEXT` | No | 可选仓库、文件、分支或 artifact 上下文 | `当前分支 + docs/plans/example.md` |
| `DEPTH` | No | `normal` 或 `brief`，默认 `normal` | `brief` |

## 输出

```markdown
## Recommended Route

- Command:
- Skill:
- Core agent:
- Capability packs:
- Required inputs:
- Validation expectations:
- Fallback path:
```

如果需要一串工作流步骤，输出最短安全序列。

`DEPTH=brief` 时只输出固定字段；默认 `normal` 可附一行简短理由。

## 示例

```text
/route
我需要给一个含认证和依赖升级的 PR 做评审，但不确定该用哪个命令。
```

```text
/route DEPTH=brief
Cursor 中没有 Claude slash command，如何用 nova skills 处理这个需求？
```

## 注意事项

- 不写代码。
- 不写计划文件或路由 artifact。
- 不运行测试、安装、Git 或外部 review 命令。
- 不发明不存在的命令、skill、agent 或 pack。
- 不把验证建议描述为已经通过。

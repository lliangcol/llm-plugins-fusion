# Skill: /nova-plugin:route

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `route`; stage: `explore`; canonical skill: `nova-route`
- Purpose: Choose the shortest safe next workflow route before execution starts.
- Audience: `all-users`; support risk: `none`
- Inputs: `REQUEST` (required), `DEPTH`
- Output contract: `recommended-route-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `explore`, `review`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/route.md`

## 用途

`/nova-plugin:route` 是只读第一阶段工作流路由入口，用于在开始工作前选择下一步 `nova-plugin` 命令、skill、core agent、capability packs、必需输入和验证路径。

它先把请求归类为 Explore、Plan、Review、Implement、Finalize 或 Codex loop，再推荐一个最小可执行的下一步。即使任务跨阶段，也只输出一个立即执行的 route；后续阶段只能出现在验证预期或 fallback 说明中。

## 参数

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `REQUEST` | Yes | 用户请求、任务摘要、issue、diff 上下文或不明确的工作流意图 | `我要修复这个 PR 的安全问题` |
| `DEPTH` | No | `normal` 或 `brief`，默认 `normal` | `brief` |

## 输出

```markdown
## Recommended Route

- Canonical skill:
- Command entrypoint:
- Variant parameters:
- Core agent:
- Capability packs:
- Required inputs:
- Validation expectations:
- Fallback path:
```

始终只输出一个立即执行的下一步；后续阶段只能写入验证预期或 fallback 说明，不能增加第二个 route identity。

`DEPTH=brief` 时只输出固定字段；默认 `normal` 可附一行简短理由。

## 示例

```text
/nova-plugin:route
我需要给一个含认证和依赖升级的 PR 做评审，但不确定该用哪个命令。
```

```text
/nova-plugin:route DEPTH=brief
Cursor 中没有 Claude slash command，如何用 nova skills 处理这个需求？
```

## 注意事项

- 不写代码。
- 不写计划文件或路由 artifact。
- 不运行测试、安装、Git 或外部 review 命令。
- 不发明不存在的命令、skill、agent 或 pack。
- 不把验证建议描述为已经通过。

# Claude Code Serial Checkpoint Prompt

Use this prompt when subagents are unavailable, unnecessary, or explicitly not
allowed.

```text
请串行完成该任务，并使用 checkpoint 控制上下文和断点续跑。

任务：
<TASK>

输入：
- 需求/计划：<PLAN_OR_REQUIREMENTS_PATH>
- 当前 checkpoint 目录：<CHECKPOINT_DIR>
- 输出目标：<OUTPUT_ARTIFACT_OR_CODE_SCOPE>
- 项目本地规则：<AGENTS_OR_CLAUDE_PATH_IF_AVAILABLE>

严格约束：
- 不使用 subagent。
- 不一次性读取全仓库；先根据任务边界列出需要读取的文件。
- 每轮只处理一个明确单元：一个验收点、一个模块、一个接口或一组相关 finding。
- 每轮结束写 checkpoint，下一轮只读取 checkpoint 和必要文件。
- 不输出完整源码或完整 diff，除非用户明确要求。
- 遇到范围膨胀时停止并写下一轮计划。

执行节奏：
1. 写 scope-index.md：目标、输入、文件候选、执行单元。
2. 处理 unit-001，写 checkpoint。
3. 根据 checkpoint 处理 unit-002，以此类推。
4. 所有 unit 完成后写 final-summary.md。

checkpoint 格式：
# Serial Checkpoint

## Unit
## Inputs Read
## Work Completed
## Decisions
## Validation
## Open Items
## Next Unit

final-summary.md 必须包含：
- 已完成内容
- 文件或 artifact 变更
- 验证状态
- 未完成或无法确认事项
- 下一步建议
```

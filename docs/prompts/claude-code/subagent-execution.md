# Claude Code Subagent Execution Prompt

Use this prompt when a task is large enough to split safely across independent
agents or workers.

```text
请使用 subagents 分工执行该任务，并把结果汇总成可继续执行的 artifact。

任务：
<TASK>

输入：
- 需求/计划：<PLAN_OR_REQUIREMENTS_PATH>
- 目标输出目录：<OUTPUT_DIR>
- 项目本地规则：<AGENTS_OR_CLAUDE_PATH_IF_AVAILABLE>
- 验证要求：<VALIDATION_REQUIREMENTS>

分工规则：
- 先识别哪些工作是并行的 sidecar task，哪些是当前主路径阻塞项。
- 不要把下一步立即依赖的阻塞任务交给 subagent 后空等；主 agent 应继续做不重叠的工作。
- 每个 subagent 的任务必须自包含、有明确输出、写入边界不重叠。
- 代码修改型 subagent 必须说明负责文件或模块，且不得回退他人改动。
- 信息收集型 subagent 必须只回答具体问题，不做泛泛探索。
- 汇总时保留证据、风险、未覆盖范围和验证结果。

建议角色：
- explorer：读取代码并回答具体问题。
- worker：负责明确文件集合内的实现或文档修改。
- verifier：并行跑检查或审查风险，但不阻塞主路径。

输出结构：
# Subagent Execution Summary

## Main Path Work
## Delegated Work
| Agent | Scope | Output | Status |
| --- | --- | --- | --- |

## Integrated Findings
## Files Changed
## Validation
## Remaining Risks
## Next Step
```

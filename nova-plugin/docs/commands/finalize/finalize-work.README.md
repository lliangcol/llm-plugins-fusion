# /nova-plugin:finalize-work

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `finalize-work`; stage: `finalize`; canonical skill: `nova-finalize-work`
- Purpose: Package completed work into review-ready handoff text without changing the completed state.
- Audience: `all-users`; support risk: `none`
- Inputs: `WORK_SUMMARY` (required), `DEPTH`
- Output contract: `finalize-work-v2`; authorization: `read-only-shell-prompt`
- Effects: `shell`, `workspace-read`
- Related workflows: `finalize-lite`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/finalize-work.md`

## 命令定位

- 总结并打包已完成工作成果，不做新改动。
- 适用：需要 commit/PR 描述或交接总结。
- 不该用于：仍在改动或需要新决策。

## 参数说明

| 参数           | 必填 | 说明                             | 示例                 |
| -------------- | ---- | -------------------------------- | -------------------- |
| `WORK_SUMMARY` | Yes  | 已完成变更及验证上下文。         | `文档修复及校验结果` |
| `DEPTH`        | No   | `lite` / `standard`，默认后者。  | `standard`           |

## 输出说明

- 固定顺序为 `title or commit message`、`change summary`、`validation`、`handoff`、`out-of-scope follow-up`。
- 示例输出结构：

```text
1. title or commit message
2. change summary
3. validation
4. handoff
5. out-of-scope follow-up
```

## 完整示例

```text
/nova-plugin:finalize-work
WORK_SUMMARY="已完成命令文档修复并通过 docs 校验"
```

```text
/nova-plugin:finalize-work
WORK_SUMMARY="无 Git 项目中的已完成改动与验证" DEPTH=lite
```

```text
/nova-plugin:finalize-work
请继续修改代码。
```

## 错误用法/反例

- 总结阶段继续修改代码。
- 缺少任一固定输出字段。

## 与相近命令的对比

- `/nova-plugin:finalize-lite` 仅输出三点总结。

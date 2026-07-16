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

| 参数         | 必填 | 说明                           | 示例             |
| ------------ | ---- | ------------------------------ | ---------------- |
| `WORK_SCOPE` | No   | 当前已完成的改动范围（隐含）。 | `当前工作区改动` |

## 输出说明

- 有 Git：commit message + PR 描述；无 Git：本地总结 + 手动步骤；必须包含变更/原因/限制/后续。
- 示例输出结构：

```text
Case A (Git): commit message + PR description
Case B (No Git): local change summary + manual steps
```

## 完整示例

```text
/nova-plugin:finalize-work
请生成 commit message 和 PR 描述。
```

```text
/nova-plugin:finalize-work
无 Git 项目，请给出交接总结。
```

```text
/nova-plugin:finalize-work
请继续修改代码。
```

## 错误用法/反例

- 总结阶段继续修改代码。
- 缺少必填四部分。

## 与相近命令的对比

- `/nova-plugin:finalize-lite` 仅输出三点总结。

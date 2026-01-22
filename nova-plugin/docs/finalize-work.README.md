# /finalize-work
- 来源：`nova-plugin/commands/finalize-work.md`

## 命令定位
- 总结并打包已完成工作成果，不做新改动。
- 适用：需要 commit/PR 描述或交接总结。
- 不该用于：仍在改动或需要新决策。

## 参数说明
| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `WORK_SCOPE` | No | 当前已完成的改动范围（隐含）。 | `当前工作区改动` |

## 输出说明
- 有 Git：commit message + PR 描述；无 Git：本地总结 + 手动步骤；必须包含变更/原因/限制/后续。
- 示例输出结构：
```text
Case A (Git): commit message + PR description
Case B (No Git): local change summary + manual steps
```

## 完整示例
```text
/finalize-work
请生成 commit message 和 PR 描述。
```

```text
/finalize-work
无 Git 项目，请给出交接总结。
```

```text
/finalize-work
请继续修改代码。
```

## 错误用法/反例
- 总结阶段继续修改代码。
- 缺少必填四部分。

## 与相近命令的对比
- `/finalize-lite` 仅输出三点总结。

# /codex-review-only

- 来源：`nova-plugin/commands/codex-review-only.md`

## 命令定位

- 使用外部脚本调起 Codex，对当前分支输出结构化 review 报告
- 适用：想先 review，暂时不进入修复

## 参数说明

| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `BASE` | No | 基线分支 | `main` |
| `REVIEW_MODE` | No | `branch` / `staged` / `full` | `staged` |

## 示例

```text
/codex-review-only BASE=main
```

```text
/codex-review-only REVIEW_MODE=full
```

通过插件运行时，内部脚本应优先经 `${CLAUDE_PLUGIN_ROOT}` 调用，而不是假设当前仓库存在 `nova-plugin/` 目录。

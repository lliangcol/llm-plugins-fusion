# /finalize-lite
- 来源：`nova-plugin/commands/finalize-lite.md`

## 命令定位
- 快速三点式总结已完成工作。
- 适用：简短总结、无完整交付需求。
- 不该用于：需要 commit/PR 或完整交付文档。

## 参数说明
| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `ARGUMENTS` | No | 总结范围说明。 | `本次变更内容` |

## 输出说明
- 输出包含 What changed / Why / Limitations。
- 示例输出结构：
```text
What changed: ...
Why: ...
Limitations: ...
```

## 完整示例
```text
/finalize-lite
总结这次修复。
```

```text
/finalize-lite
用三行说明改动与限制。
```

```text
/finalize-lite
请继续优化并改代码。
```

## 错误用法/反例
- 引入新决策或改动。
- 缺少三要素之一。

## 与相近命令的对比
- `/finalize-work` 输出完整交付材料。

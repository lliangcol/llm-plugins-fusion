# /plan-lite
- 来源：`nova-plugin/commands/plan-lite.md`

## 命令定位
- 输出轻量执行计划，明确目标、边界、取舍与高层步骤。
- 适用：快速形成执行路径、无需正式设计文档。
- 不该用于：正式可评审设计文档、实现代码编写。

## 参数说明
| 参数 | 必填 | 说明 | 示例 |
| --- | --- | --- | --- |
| `ARGUMENTS` | No | 需求或上下文描述。 | `目标与约束说明` |

## 输出说明
- 固定输出 Goal / Non-Goals / Chosen Approach / Key Trade-offs / Execution Outline / Key Risks。
- 示例输出结构：
```text
### Goal
- ...

### Non-Goals
- ...

### Chosen Approach
- ...

### Key Trade-offs
- ...

### Execution Outline
- ...

### Key Risks
- ...
```

## 完整示例
```text
/plan-lite
目标：新增用户积分转赠
边界：不改动支付模块
```

```text
/plan-lite
基于已完成分析产出轻量计划，关注风险与取舍。
```

```text
/plan-lite
请给出详细架构设计和实现细节。
```

## 错误用法/反例
- 写入生产代码或实现细节。
- 过度扩展范围或假设未给出的需求。

## 与相近命令的对比
- `/produce-plan` 产出正式设计文档并写入文件。
- `/backend-plan` 面向 Java/Spring 后端设计。

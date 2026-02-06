# Skill: /implement-lite

- 来源：`nova-plugin/commands/implement-lite.md`

## 适用场景

- 小功能或快速修复。
- 明确指令的快速实现。

## 输入参数

### Required

- 无

### Optional

- `ARGUMENTS`: 实现目标与约束说明。示例: `修复描述`

## 行为准则（Do/Don't）

### Do

- 快速实现并保持务实。
- 仅做必要小幅调整。

### Don't

- 过度优化或扩展范围。
- 进行大重构。

## 详细执行步骤

1. 理解目标与约束。
2. 快速实现。
3. 避免范围漂移。

## 输出规范

- 命令未规定固定输出结构；重点是快速完成实现。

## 典型示例

```text
/implement-lite
请快速实现手机号脱敏。
```

```text
/implement-lite
优化枚举查找并补测试。
```

```text
/implement-lite
请给出完整设计与架构方案。
```

## 常见误用与纠正

- 误用：过度工程或大范围重构。纠正：保持小范围变更。
- 误用：扩展超出需求。纠正：按给定范围实施。

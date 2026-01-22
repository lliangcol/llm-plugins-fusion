# Skill: /review-strict
- 来源：`nova-plugin/commands/review-strict.md`

## 适用场景
- 核心业务或高风险模块审计。
- 发布前严格评审。

## 输入参数
### Required
- 无

### Optional
- `ARGUMENTS`: 待审查内容。示例: `核心模块代码`

## 行为准则（Do/Don't）
### Do
- 覆盖正确性、边界、并发、性能等维度。
- 为每项问题说明风险。

### Don't
- 写或修改代码。
- 输出实现细节。

## 详细执行步骤
1. 逐维度审查输入内容。
2. 按严重性分组记录问题。
3. 输出方向性建议而非实现。

## 输出规范
- 输出按 Critical / Major / Minor 分组，说明风险与方向性建议。

## 典型示例
```text
/review-strict
请审查支付核心逻辑代码：...
```

```text
/review-strict
对并发敏感模块做严格审计。
```

```text
/review-strict
请直接修复并提交代码。
```

## 常见误用与纠正
- 误用：提供实现级修复代码。纠正：仅给方向性建议。
- 误用：缺少风险理由。纠正：说明每项问题的重要性。

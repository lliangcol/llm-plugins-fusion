# /review-strict

- 来源：`nova-plugin/commands/review-strict.md`

## 命令定位

- 高风险或关键代码的严格、全面审查。
- 适用：核心业务审计、发布前评审。
- 不该用于：日常轻量审查或实现修改。

## 参数说明

| 参数        | 必填 | 说明         | 示例           |
| ----------- | ---- | ------------ | -------------- |
| `ARGUMENTS` | No   | 待审查内容。 | `核心模块代码` |

## 输出说明

- 输出按 Critical / Major / Minor 分组，说明风险与方向性建议。
- 示例输出结构：

```text
### Critical
- Issue / Why / Directional suggestion

### Major
- ...

### Minor
- ...
```

## 完整示例

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

## 错误用法/反例

- 提供实现级修复代码。
- 缺少风险理由或假设说明。

## 与相近命令的对比

- `/review-only` 中等强度审查。
- `/review-lite` 轻量快速审查。

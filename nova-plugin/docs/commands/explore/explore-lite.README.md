# /nova-plugin:explore-lite

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `explore-lite`; stage: `explore`; canonical skill: `nova-explore`
- Purpose: Produce concise factual observations, uncertainties, and risks from knowledge gaps.
- Audience: `all-users`; support risk: `none`
- Inputs: `INPUT` (required)
- Output contract: `exploration-lite-v2`; authorization: `read-only`
- Effects: `workspace-read`
- Related workflows: `explore`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/explore-lite.md`

## 命令定位

- 快速理解与认知对齐，列出已知、未知与风险，不提出方案。
- 适用：快速梳理清晰度、会议前对齐。
- 不该用于：深入分析、设计或实现方案。

## 参数说明

| 参数        | 必填 | 说明                       | 示例                 |
| ----------- | ---- | -------------------------- | -------------------- |
| `ARGUMENTS` | Yes  | 任意输入上下文或问题描述。 | `需求描述或日志片段` |

## 输出说明

- 固定输出 Observations / Uncertainties / Potential risks。
- 示例输出结构：

```text
### Observations
- ...

### Uncertainties
- ...

### Potential risks
- ...
```

## 完整示例

```text
/nova-plugin:explore-lite
我们要新增订单退款接口，已有订单模块与支付模块。请快速梳理不清楚的点。
```

```text
/nova-plugin:explore-lite
线上告警：Connection pool exhausted。请列出不确定点和可能风险。
```

```text
/nova-plugin:explore-lite
请直接给我完整解决方案和实施步骤。
```

## 错误用法/反例

- 提出设计方案或重构建议。
- 输出实现细节或代码。

## 与相近命令的对比

- `/nova-plugin:senior-explore` 更深度、更系统。
- `/nova-plugin:explore-review` 以 reviewer 问题与风险信号为主。

# Skill: /nova-plugin:backend-plan

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `backend-plan`; stage: `plan`; canonical skill: `nova-produce-plan`
- Purpose: Produce a complete Java and Spring backend design artifact for senior review without implementing code.
- Audience: `backend-users`; support risk: `low`
- Inputs: `REQUEST` (required), `PLAN_OUTPUT_PATH` (required)
- Output contract: `backend-plan-v2`; authorization: `artifact-write`
- Effects: `artifact-write`, `workspace-read`
- Related workflows: `produce-plan`, `implement-plan`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/backend-plan.md`

## 适用场景

- 需要 Java/Spring 后端设计文档。
- 计划需覆盖一致性、并发与持久化等关键点。

## 输入参数

### Required

- `REQUEST`: 要解决的问题、目标与约束。示例: `设计订单取消后端方案`
- `PLAN_OUTPUT_PATH`: 计划文档输出路径。示例: `docs/plans/backend.md`

### Optional

- 无

## 行为准则（Do/Don't）

### Do

- 按指定章节完整输出。
- 写入文件并覆盖已有内容。

### Don't

- 写或修改 Java 代码。
- 跳过必填章节或推断未给出的细节。

## 详细执行步骤

1. 验证 REQUEST 与 PLAN_OUTPUT_PATH 是否提供。
2. 按指定结构编写完整设计计划并写入文件。
3. 聊天只输出路径与三条摘要。

## 输出规范

- 写入完整设计计划到 PLAN_OUTPUT_PATH；聊天仅输出路径与三条摘要。

## 典型示例

```text
/nova-plugin:backend-plan
REQUEST: 设计订单取消的 Java/Spring 后端方案
PLAN_OUTPUT_PATH: docs/plans/order-backend.md
```

```text
/nova-plugin:backend-plan
REQUEST: 设计账户服务的 Java/Spring 后端方案
PLAN_OUTPUT_PATH: docs/plans/account-service.md
```

```text
/nova-plugin:backend-plan
REQUEST: 设计订单后端方案，但缺少 PLAN_OUTPUT_PATH
```

## 常见误用与纠正

- 误用：直接编写或修改 Java 代码。纠正：仅输出设计计划文档。
- 误用：跳过必填章节。纠正：保持完整章节结构。

# /nova-plugin:backend-plan

<!-- generated:command-contract:start -->
> Generated from `workflow-specs/workflows.v6.json`, `workflow-specs/behaviors.v2.json`, and `governance/workflow-docs.json` by `node scripts/generate-command-docs.mjs --write`. Do not edit this block.

- Workflow: `backend-plan`; stage: `plan`; canonical skill: `nova-produce-plan`
- Purpose: Produce a complete Java and Spring backend design artifact for senior review without implementing code.
- Audience: `backend-users`; support risk: `low`
- Inputs: `REQUEST` (required), `PLAN_OUTPUT_PATH` (required)
- Output contract: `backend-plan-v2`; authorization: `artifact-write`
- Effects: `artifact-write`, `workspace-read`, `workspace-write`
- Related workflows: `produce-plan`, `implement-plan`
<!-- generated:command-contract:end -->

- 来源：`nova-plugin/commands/backend-plan.md`

## 命令定位

- 输出 Java/Spring 后端设计计划文档并写入指定路径。
- 适用：需要后端设计文档、覆盖一致性与并发等要点。
- 不该用于：通用/轻量计划、直接实现代码。

## 参数说明

| 参数               | 必填 | 说明               | 示例                    |
| ------------------ | ---- | ------------------ | ----------------------- |
| `PLAN_OUTPUT_PATH` | Yes  | 计划文档输出路径。 | `docs/plans/backend.md` |

## 输出说明

- 写入完整计划到 PLAN_OUTPUT_PATH；聊天仅输出路径与三条摘要。
- 示例输出结构：

```text
计划文档结构:
1. Background & Problem Statement
2. Scope Definition
3. Business Rules & Invariants
4. Architecture Overview
5. Data Model & Persistence
6. Transaction & Consistency Design
7. Concurrency & Idempotency
8. Error Handling & Observability
9. Implementation Plan (Step-by-Step)
10. Testing Strategy
11. Rollback & Safety Plan
12. Risks & Open Questions
```

## 完整示例

```text
/nova-plugin:backend-plan
PLAN_OUTPUT_PATH: docs/plans/order-backend.md
```

```text
/nova-plugin:backend-plan
PLAN_OUTPUT_PATH: docs/plans/account-service.md
```

```text
/nova-plugin:backend-plan
缺少 PLAN_OUTPUT_PATH
```

## 错误用法/反例

- 写或修改 Java 代码。
- 跳过必填章节。

## 与相近命令的对比

- `/nova-plugin:produce-plan` 为通用设计文档，不含 Java/Spring 专项章节。
- `/nova-plugin:plan-lite` 仅产出轻量计划。

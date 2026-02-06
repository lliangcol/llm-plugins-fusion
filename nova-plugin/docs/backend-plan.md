# Skill: /backend-plan

- 来源：`nova-plugin/commands/backend-plan.md`

## 适用场景

- 需要 Java/Spring 后端设计文档。
- 计划需覆盖一致性、并发与持久化等关键点。

## 输入参数

### Required

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

1. 验证 PLAN_OUTPUT_PATH 是否提供。
2. 按指定结构编写完整设计计划并写入文件。
3. 聊天只输出路径与三条摘要。

## 输出规范

- 写入完整设计计划到 PLAN_OUTPUT_PATH；聊天仅输出路径与三条摘要。

## 典型示例

```text
/backend-plan
PLAN_OUTPUT_PATH: docs/plans/order-backend.md
```

```text
/backend-plan
PLAN_OUTPUT_PATH: docs/plans/account-service.md
```

```text
/backend-plan
缺少 PLAN_OUTPUT_PATH
```

## 常见误用与纠正

- 误用：直接编写或修改 Java 代码。纠正：仅输出设计计划文档。
- 误用：跳过必填章节。纠正：保持完整章节结构。

# Claude Code 自定义命令《详细使用手册》（按类型组织）

> 本手册`commands` 目录中的命令定义解析整理而来，按「探索 / 规划 / 评审 / 实施 / 收尾」五类组织，并给出**覆盖常见场景的用法模板**与**相似命令差异/判定表**。
>
> 适用对象：团队研发、TL、Reviewer；
>
> 适用场景：需求梳理、排障、方案评审、计划落地、代码实现、PR 评审与工作收尾。

---

## 0. 命令分层与"工作流"定位

这组命令本质上把一次工程活动拆成五个阶段：

1. **Explore（探索/理解）**：只做理解与风险暴露，不做方案与实现
2. **Plan（规划/设计）**：把选择与边界写成计划文档（轻量或正式）
3. **Review（评审）**：对现有代码/描述/计划做审查，不写代码
4. **Implement（实施）**：按计划执行实现（强约束/中约束/快节奏）
5. **Finalize（收尾）**：冻结现状，产出交付物（PR 描述、commit message、变更总结）

---

## 1. 快速决策：我现在该用哪个命令？

### 1.1 一句话判定表（最常用）

| 你现在要做什么？ | 推荐命令 | 关键理由 |
|---|---|---|
| 先把问题/需求/现状搞清楚，不要任何方案 | `/senior-explore` | 明确禁止"建议/实现/设计"，只输出事实、问题、风险 |
| 快速对齐理解（轻量版探索）            | ⭐`/explore` 或 `/explore-lite`   | **统一命令**：默认观察者视角，输出更短 |
| 用"评审者心态"梳理问题，但仍不许给方案 | ⭐`/explore PERSPECTIVE=reviewer` 或 `/explore-review` | **统一命令**：评审者视角，只输出 clear / questions / risk signals |
| 需要一份**轻量执行计划**（不写代码）         | `/plan-lite` | 目标、非目标、选型、权衡、执行大纲、关键风险 |
| 需要一份**正式可评审的设计/计划文档**写入文件 | `/produce-plan` 或 `/backend-plan` | 强制写文件 + 固定章节结构；前者更通用，后者偏 Java/Spring |
| 对"计划文档"做决策质量评审（不改计划）        | `/plan-review` | 只看决策清晰度、隐含假设、风险信号、必须回答的问题 |
| 对现有代码/描述做快速 PR 反馈                | `/review-lite` | 快、只抓明显问题，高信噪比 |
| 对现有代码做常规严格评审（不给实现）          | ⭐`/review` 或 `/review-only` | **统一命令**：标准级别，分严重级别 + 给方向性改进建议 |
| 高风险/核心模块/金融并发场景做"严苛审计式评审" | ⭐`/review LEVEL=strict` 或 `/review-strict` | **统一命令**：严格级别，穷尽维度输出 |
| 已有**批准的 plan 文件**，要严格按计划实现    | `/implement-plan` | 必须提供 `PLAN_APPROVED=true`，偏差要解释 |
| 有计划或明确步骤，但允许少量纠错              | `/implement-standard` | 计划为主，允许小调整，遇阻停下提问 |
| 追求速度、允许小重构与必要的微调              | `/implement-lite` | "快实现"，避免过度设计 |
| 做完了要交付：commit/PR/变更总结（不再改代码） | `/finalize-work` 或 `/finalize-lite` | 前者更完整（含 Git/无 Git 分支），后者极简三要素 |

---

## 2. 命令类型一：Explore（探索 / 理解）

> 核心原则：**只理解，不决策**；只暴露事实/问题/风险。

### 2.1 `/senior-explore` — EXPLORE ONLY（强约束探索）

**定位**
- 只做分析与理解，明确禁止：设计、重构提案、实现细节、代码、架构推荐
- 输出固定三段：Key findings / Open questions / Potential risks

**何时使用**（覆盖场景）
- 新需求/产品想法：先确认边界与未知
- 线上故障：先抽丝剥茧，不急着开药方
- 复杂域模型：先统一认知，找出假设
- 选型可行性：先列证据与风险，不给"推荐方案"

**输入模板（把 `$ARGUMENTS` 填好）**
- Intent（必填）、Context（建议）、Constraints、Depth、Export path（可选，导出与聊天完全一致）

**输出你会得到什么**
- 可直接作为后续 `/plan-lite` 或 `/produce-plan` 的分析输入（ANALYSIS_INPUTS）。

**使用示例**

1) 线上问题排查（带日志、限制不讨论方案）
```text
/senior-explore
INTENT: Investigate a production issue or bug
CONTEXT:
- Error logs: (paste stacktrace)
- Related modules: com.xxx.payment.*, com.xxx.order.*
- Recent changes: PR#1234 (link)
CONSTRAINTS:
- Only analyze current behavior, no future redesign
DEPTH: deep
EXPORT_PATH: docs/analysis/2026-01-10-payment-timeout.md
```

2) 新功能需求理解（把需求文档/接口草案贴上）
```text
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT:
- Requirement: (paste)
- Existing API: /v1/subscription/...
CONSTRAINTS:
- Focus on correctness, not performance
DEPTH: normal
```

---

### 2.2 `/explore-lite` — QUICK UNDERSTANDING（轻量探索）

**定位**
- 快速对齐理解，不解决问题：禁止写代码、禁止给方案/设计/重构建议
- 输出更短：Observations / Uncertainties / Potential risks

**适用**
- Standup 前快速同步认知
- Review 前先统一"我们在看什么"
- 你只需要 5~10 分钟的梳理

**示例**
```text
/explore-lite
这里是现有逻辑说明 + 两段关键代码 + 我遇到的疑问
（要求：只指出哪里不清楚、有哪些风险，不要给解决方案）
```

---

### 2.2.5 ⭐ `/explore` — UNIFIED EXPLORATION（统一探索命令，推荐）

**定位**
- **统一命令**：通过 `PERSPECTIVE` 参数选择视角，减少命令选择成本
- 支持两种视角：`observer`（观察者，默认）/ `reviewer`（评审者）
- 禁止写代码、禁止给方案/设计/重构建议

**参数**
```text
PERSPECTIVE=observer (默认) 或 reviewer
```

**等价关系**
| PERSPECTIVE | 等价命令 | 输出格式 |
|-------------|---------|---------|
| `observer` | `/explore-lite` | Observations / Uncertainties / Potential risks |
| `reviewer` | `/explore-review` | What is clear / Review questions / Risk signals |

**适用**
- 需要快速理解/对齐，但不想记忆多个命令
- 想根据场景灵活切换视角

**示例**

1) 默认观察者视角（省略参数）
```text
/explore
线上告警: "Connection pool exhausted"
- 服务: user-service
- 时间: 每天 10:00-11:00
快速梳理可能原因，不需要解决方案
```

2) 评审者视角
```text
/explore PERSPECTIVE=reviewer
【需求文档】会员等级自动升降级
- 消费满1000元升级为银卡
- 消费满5000元升级为金卡
- 连续6个月无消费降一级

用 reviewer 视角输出评审问题和风险信号
```

**优势**
- 统一入口，减少记忆负担
- 保留灵活性，支持未来扩展新视角
- 原有命令仍然可用，向后兼容

---

### 2.3 `/explore-review` — REVIEW WITHOUT SOLUTIONS（评审视角探索）

**定位**
- 用 reviewer 心态"质询与识别风险"，但仍明确禁止给方案/推荐/实现
- 输出三段：What is clear / Review questions / Risk signals

**适用**
- 评审会前的"问题清单生成器"
- 需求/设计描述不完整时：先生成 reviewer 会问的问题

**示例**
```text
/explore-review
这是某同学的方案描述（粘贴），请按 reviewer 心态输出：
- clear
- questions
- risk signals
（不要给方案，不要建议）
```

---

## 3. 命令类型二：Plan（规划 / 设计）

> 核心原则：**把决策写下来**，让人类能评审；实现不在此阶段。

### 3.1 `/plan-lite` — LIGHTWEIGHT PLANNING（轻量计划）

**定位**
- 产出轻量执行计划，不是正式设计文档
- 禁止写生产代码、禁止过度设计、禁止扩 scope
- 固定输出：Goal / Non-Goals / Chosen Approach / Trade-offs / Execution Outline / Key Risks

**适用**
- 小中型需求：一天内能落地
- 已有探索结论，需要"下一步怎么做"的对齐
- TL 需要快速确认边界

**示例（从探索结论转计划）**
```text
/plan-lite
目标：修复订阅回调幂等问题
输入：/senior-explore 的 findings + open questions（粘贴摘要）
约束：不改数据库结构；必须向后兼容
```

---

### 3.2 `/produce-plan` — DESIGN CHECKPOINT（正式计划/设计文档，写入文件）

**定位**
- "设计检查点"：输出是可评审的技术决策文档
- 强制写到 `PLAN_OUTPUT_PATH`，缺失必须停下并让用户提供路径
- 强制包含固定章节：背景、目标/非目标、约束、备选方案、最终方案、分步计划、风险与缓解、测试、回滚…
- 聊天中只输出：文件路径 + 3~5 条执行摘要

**适用**
- 需要评审的改造/新模块
- 多人协作、需要明确 trade-off 与可追溯
- 未来可能要复盘（计划即证据链）

**示例**
```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/2026-01-10-subscription-idempotency.md
PLAN_INTENT: Fix production issue and prevent duplicate reporting
ANALYSIS_INPUTS:
- docs/analysis/2026-01-09-subscription-callback.md
CONSTRAINTS:
- No DB schema change
- Must keep Stripe webhook throughput
```

---

### 3.3 `/backend-plan` — JAVA / SPRING BACKEND DESIGN PLAN（Java 后端专项正式设计）

**定位**
- 和 `/produce-plan` 同类，但面向 Java/Spring，并明确"不要写 Java 代码；Design only"
- 强制写文件（PLAN_OUTPUT_PATH），强制 12 个章节，覆盖事务、一致性、幂等、可观测性、回滚等

**适用**
- 涉及事务/一致性/并发/幂等的后端改造
- 需要"工程化可落地"的后端方案文档

**示例**
```text
/backend-plan
PLAN_OUTPUT_PATH: docs/plans/ads-callback-reporting.md
（粘贴需求 + 现有 callback 逻辑 + 关键表结构）
```

---

### 3.4 `/plan-review` — PLAN CRITICAL REVIEW（计划评审）

**定位**
- 评审计划的"决策质量"和"执行风险"，不改写计划、不提出替代方案
- 强制语言约束：避免 should/recommend/solution 等词
- 输出结构：Decision clarity / Assumptions & gaps / Risk signals / Review questions

**适用**
- 评审会前把"要问的问题"先准备好
- TL 对计划做 gate：不看实现，只看可执行性与风险

**示例**
```text
/plan-review
这是同学写的计划文档（粘贴或给链接/摘要）
请只按 plan-review 的结构输出评审意见，不要给替代方案
```

---

## 4. 命令类型三：Review（评审，不写实现）

> 核心原则：**只评审，不动手写代码**。

### 4.1 `/review-lite` — LIGHTWEIGHT REVIEW（轻量评审）

**定位**
- 快速、轻量；聚焦明显问题与高信噪比反馈
- 明确不深挖架构重构、未来扩展、微优化
- 输出：Findings（可加 [Bug]/[Risk]/[Readability]/[Overengineering] 标签）

**适用**
- 日常 PR，改动不大
- 你只想要 5~15 条高价值反馈

**示例**
```text
/review-lite
这是 PR diff（粘贴关键段）+ 变更目的
请只输出 bullet findings，不要写代码
```

---

### 4.1.5 ⭐ `/review` — UNIFIED CODE REVIEW（统一代码评审命令，推荐）

**定位**
- **统一命令**：通过 `LEVEL` 参数选择评审严格程度
- 支持两种级别：`standard`（标准，默认）/ `strict`（严格）
- 禁止写代码、禁止提供完整实现示例
- 统一输出格式：Critical / Major / Minor 分级

**参数**
```text
LEVEL=standard (默认) 或 strict
```

**等价关系**
| LEVEL | 等价命令 | 评审维度 | 语气 |
|-------|---------|---------|------|
| `standard` | `/review-only` | 7 项标准维度 | 中立、精确 |
| `strict` | `/review-strict` | 9 项维度（+API边界、演进风险等） | 批判但建设性 |

**评审维度**

**standard 级别**：
- 正确性
- 过度工程或不必要的复杂性
- 性能问题
- 并发/线程安全风险
- 错误处理和失败模式
- 测试覆盖率和测试质量
- 可维护性和长期可读性

**strict 级别（额外）**：
- API 或模块边界清晰度
- 长期演进风险
- 安全漏洞
- 数据完整性风险
- 运维弹性

**适用**
- 标准级别：日常代码评审、PR 审查
- 严格级别：生产关键代码、资金结算、并发高风险场景

**示例**

1) 标准评审（默认）
```text
/review
这是支付回调处理的核心代码，请评审:

@Transactional
public void handlePaymentCallback(PaymentCallback callback) {
    Order order = orderRepository.findByOrderNo(callback.getOrderNo());
    order.setStatus(OrderStatus.PAID);
    orderRepository.save(order);
    messageQueue.send("order-paid", order.getId());
}

请按 Critical/Major/Minor 分级给出评审意见
```

2) 严格审计
```text
/review LEVEL=strict
这是核心的资金结算逻辑，需要严格审计:
(粘贴代码)
这是高风险代码，请用 strict 级别全面审计
```

**优势**
- 统一命令，只需决定严格程度
- 输出格式完全一致，便于对比和追踪
- 减少命令选择成本
- 原有命令仍然可用，向后兼容

**注意**：`/review-lite` 是更轻量的快速评审，不在统一命令范围内。

---

### 4.2 `/review-only` — REVIEW ONLY, NO IMPLEMENTATION（常规严格评审）

**定位**
- 审查维度更全：正确性、复杂度、性能、并发、错误处理、测试、可维护性等
- 输出按严重级别：Critical / Major / Minor，每条解释"为什么重要"，给**方向性建议**但不写代码

**适用**
- 中等风险改动、核心链路 PR
- 你希望 reviewer 输出更系统

**示例**
```text
/review-only
请 review 这段支付回调处理逻辑 + 对应单测（粘贴）
要求：按 Critical/Major/Minor 输出，给方向性建议，不写代码
```

---

### 4.3 `/review-strict` — STRICT & EXHAUSTIVE REVIEW（高风险穷尽式评审）

**定位**
- 高风险、生产关键：假设可能运行在生产，失败代价高
- 强制覆盖更多维度：功能、边界、并发、性能、可观测性、测试、长期演进等
- 同样不写代码，但要求对每个问题解释"为什么严重/昂贵"，并给方向性改进建议

**适用**
- 金融/支付/状态机/并发敏感组件
- 大重构、基础设施、框架级改动
- 上线前 gate 审计

**示例**
```text
/review-strict
输入：核心扣费链路代码（贴或给文件）
要求：按 Critical/Major/Minor 输出，解释影响，不给实现代码
```

---

## 5. 命令类型四：Implement（实施 / 写代码）

> 核心原则：**按计划执行**；约束越强，越不允许临场发挥。

### 5.1 `/implement-plan` — CONTROLLED EXECUTION（严格按"已批准计划"执行）

**定位**
- 实现 ONLY，严格基于**已批准的 plan 文档**
- 必填：`PLAN_INPUT_PATH`，缺失即停
- 必填：`PLAN_APPROVED` 且必须严格等于 `true`，否则阻塞
- 偏差策略：只有发现正确性/可行性/安全阻塞才允许偏差，且必须解释

**适用**
- 团队已经评审通过 plan
- 需要"执行一致性"与"可追溯"
- 容错低的改动（上线风险大）

**示例**
```text
/implement-plan
PLAN_INPUT_PATH: docs/plans/2026-01-10-subscription-idempotency.md
PLAN_APPROVED: true
```

---

### 5.2 `/implement-standard` — CONTROLLED EXECUTION（中等约束实施）

**定位**
- 基于确认的 plan 或明确步骤实现；不重设方案；允许少量纠错
- 发现阻塞：必须停下说明并请求澄清或更新计划

**适用**
- 有明确步骤，但未走"计划批准"流程
- TL 允许"遇到现实假设不成立时微调"
- 不想被 `/implement-plan` 的 `PLAN_APPROVED` 卡住

**示例**
```text
/implement-standard
按以下步骤实现：
1) 在 callback 中增加幂等校验（report_iaa）
2) 付费用户直接回传
3) 否则补齐广告统计字段校验
（遇到阻塞请停止并说明）
```

---

### 5.3 `/implement-lite` — FAST EXECUTION（快节奏实施）

**定位**
- 追求产出速度：基于指令或上下文实现
- 允许小范围设计调整与小重构（前提是提升正确性/清晰度）
- 明确"避免过度工程"

**适用**
- 低风险、小需求、小修复
- 你已经很确定方向，只要快速把代码落下去
- 允许"顺手把糟糕的命名/重复代码稍微收拾一下"

**示例**
```text
/implement-lite
需求：把 DaysRangeEnum 的 getByCode 改成 O(1) 并补单测
约束：不改 public API
```

---

## 6. 命令类型五：Finalize（收尾 / 交付打包）

> 核心原则：**冻结现状**，只"描述与打包"，不再做新决策或修改。

### 6.1 `/finalize-work` — FINALIZE WORK ARTIFACTS（完整收尾）

**定位**
- 纯总结与打包：不改代码、不重构、不扩 scope、不做新决策
- 依据是否有 Git 仓库分两种输出：
  - 有 Git：commit message + PR 描述（含 changed/why/limitations/follow-up）
  - 无 Git：本地变更总结 + 手动部署/交接步骤
- 输出必须包含：What changed / Why / Known limitations / Follow-up

**适用**
- 你准备提 PR 或交接给同事
- 需要严格、可审核的"收尾说明"
- 团队希望每次变更都有标准化交付物

**示例**
```text
/finalize-work
（Claude Code 基于当前工作区状态总结）
```

---

### 6.2 `/finalize-lite` — 极简收尾

**定位**
- 只有三要素：What changed / Why / Limitations；明确不做新改动、新决策

**适用**
- 小任务快速收尾（比如帮同事把输出整理成一句话摘要）
- 你已经有 PR 模板，只需要填 3 行

**示例**
```text
/finalize-lite
请对本次修复做三行总结：changed / why / limitations
```

---

## 7. 相似命令差异与选型建议（重点）

### 7.1 Explore 三兄弟：`/senior-explore` vs `/explore-lite` vs `/explore-review`

| 对比维度 | `/senior-explore` | `/explore-lite` | `/explore-review` |
|---|---|---|---|
| 目标 | 最严谨的"理解与风险暴露" | 最快的"认知对齐" | 以 reviewer 心态生成问题清单 |
| 输出结构 | Findings / Questions / Risks（严格） | Observations / Uncertainties / Risks | Clear / Questions / Risk signals |
| 适用场景 | 复杂问题、线上事故、需留痕 | 轻量沟通、会议前同步 | 评审会前准备提问 |
| 风格 | 证据链、假设显式、可导出归档 | 简短直接 | 更"质询"、更像 reviewer |

---

### 7.2 Plan：`/plan-lite` vs `/produce-plan` vs `/backend-plan`

| 对比维度 | `/plan-lite` | `/produce-plan` | `/backend-plan` |
|---|---|---|---|
| 产物形态 | 聊天输出的轻量计划 | 写入文件的正式计划文档 | 写入文件的 Java/Spring 专项设计 |
| 结构强度 | 6 段固定结构 | 强制 9+ 章节（备选、回滚、缓解等） | 强制 12 章节（事务/幂等/可观测性等更突出） |
| 适用 | 小中改动 | 中大改动、多人协作、需要评审留档 | 后端核心链路、复杂一致性/并发场景 |

---

### 7.3 Review：`/review-lite` vs `/review-only` vs `/review-strict`

| 对比维度 | `/review-lite` | `/review-only` | `/review-strict` |
|---|---|---|---|
| 深度 | 轻量高信噪比 | 系统化、按严重级别 | 穷尽式、生产关键假设 |
| 输出 | bullet findings | Critical/Major/Minor + why + direction | 同上但覆盖维度更多、更严苛 |
| 适用 | 日常 PR、小改动 | 核心链路、中高风险 | 金融/并发/大重构/上线前 gate |

---

### 7.4 Implement：`/implement-plan` vs `/implement-standard` vs `/implement-lite`

| 对比维度 | `/implement-plan` | `/implement-standard` | `/implement-lite` |
|---|---|---|---|
| 约束强度 | 最强：必须 plan + `PLAN_APPROVED=true` | 中：按 plan/步骤执行，允许小纠错 | 弱：以效率为先，允许小重构 |
| 偏差处理 | 必须解释偏差，偏差大建议停下重审 | 遇阻停下，要求澄清/更新计划 | 更灵活，但仍要避免过度工程 |
| 适用 | 高风险、需可追溯 | 一般工程任务 | 低风险、小修复 |

---

## 8. 覆盖"所有常见场景"的组合打法（推荐流程）

### 场景 A：新功能（需求不清晰）
1. `/senior-explore`：明确已知/未知/风险（不提方案）
2. `/plan-lite`：把目标、非目标、方法、权衡写清
3. 需要正式评审：`/produce-plan`（写文件）
4. `/plan-review`：把评审问题提前暴露
5. 执行：`/implement-plan`（若已批准）或 `/implement-standard`
6. 收尾：`/finalize-work`

### 场景 B：线上事故/bug
1. `/senior-explore`（deep）：先还原事实与假设
2. 若需要计划/回滚说明：`/plan-lite` 或 `/produce-plan`
3. 快速落地：`/implement-standard` 或 `/implement-lite`（视风险）
4. 严格收尾：`/finalize-work`

### 场景 C：PR 评审
- 小改动：`/review-lite`
- 核心链路：`/review-only`
- 并发/金融/大重构：`/review-strict`

---

## 9. 命令清单（按类型）

### Explore
- `/senior-explore`
- `/explore-lite`
- `/explore-review`

### Plan
- `/plan-lite`
- `/produce-plan`
- `/backend-plan`
- `/plan-review`

### Review
- `/review-lite`
- `/review-only`
- `/review-strict`

### Implement
- `/implement-plan`
- `/implement-standard`
- `/implement-lite`

### Finalize
- `/finalize-work`
- `/finalize-lite`

---

## 10. 你可以直接复制的"命令调用模板库"

> 下面是你在实际项目里最常用的 8 个可复制模板。

### 10.1 需求理解（强约束）
```text
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT:
- Requirement:
- Existing endpoints/data:
CONSTRAINTS:
- Based only on provided info
DEPTH: normal
```

### 10.2 线上排障（深度）
```text
/senior-explore
INTENT: Investigate a production issue or bug
CONTEXT:
- Logs:
- Timeline:
- Suspected modules:
CONSTRAINTS:
- Only analyze current behavior, no redesign
DEPTH: deep
```

### 10.3 轻量计划
```text
/plan-lite
目标：
非目标：
约束：
（可附：senior-explore 的摘要）
```

### 10.4 正式计划（写文件）
```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/<topic>.md
PLAN_INTENT: <what>
ANALYSIS_INPUTS: <links/paths>
CONSTRAINTS: <list>
```

### 10.5 计划评审
```text
/plan-review
这里是计划全文/摘要（粘贴）
只输出：Decision clarity / Assumptions & gaps / Risk signals / Review questions
```

### 10.6 快速 PR Review
```text
/review-lite
PR 目标：
diff/关键代码：
```

### 10.7 严格按批准计划执行
```text
/implement-plan
PLAN_INPUT_PATH: docs/plans/<topic>.md
PLAN_APPROVED: true
```

### 10.8 完整收尾交付
```text
/finalize-work
（直接执行，让其基于当前工作区总结 + 生成 commit message & PR 描述）
```

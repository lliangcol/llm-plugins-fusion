# 📚 Nova Plugin 命令完全参考手册

> **版本**: 1.0.0 | **最后更新**: 2026-01-11
>
> 本手册提供 nova-plugin 所有命令的完整技术参考，包含详细参数说明、场景示例库、工作流模板。

> 设计目标：**检索场景 → 复制示例 → 修改使用**

---

## 📋 目录

- [快速场景索引](#-快速场景索引)
- [命令总览](#-命令总览)
- [探索类命令详解](#-探索类命令详解)
- [规划类命令详解](#-规划类命令详解)
- [评审类命令详解](#-评审类命令详解)
- [实现类命令详解](#-实现类命令详解)
- [收尾类命令详解](#-收尾类命令详解)
- [工作流模板库](#-工作流模板库)
- [快速参考卡片](#-快速参考卡片)

---

## 🔍 快速场景索引

> 💡 根据你的场景快速定位命令，点击场景跳转到对应示例

### 📊 场景-命令速查表

| 场景类别 | 具体场景 | 推荐命令 | 跳转 |
|---------|---------|---------|------|
| **需求分析** | 新功能需求理解 | `/senior-explore` | [示例](#场景-新功能需求分析) |
| **需求分析** | 快速对齐认知 | `/explore-lite` | [示例](#场景-快速认知对齐) |
| **需求分析** | 需求文档评审 | `/explore-review` | [示例](#场景-需求文档评审) |
| **故障排查** | 生产问题调查 | `/senior-explore` | [示例](#场景-生产问题深度排查) |
| **故障排查** | 快速问题定位 | `/explore-lite` | [示例](#场景-快速问题定位) |
| **方案设计** | 轻量任务计划 | `/plan-lite` | [示例](#场景-小型任务规划) |
| **方案设计** | 正式设计文档 | `/produce-plan` | [示例](#场景-正式设计文档) |
| **方案设计** | Java后端设计 | `/backend-plan` | [示例](#场景-java后端设计) |
| **方案评审** | 计划文档评审 | `/plan-review` | [示例](#场景-计划文档评审) |
| **代码评审** | 日常PR评审 | `/review-lite` | [示例](#场景-日常pr评审) |
| **代码评审** | 核心逻辑评审 | `/review-only` | [示例](#场景-核心逻辑评审) |
| **代码评审** | 高风险代码审计 | `/review-strict` | [示例](#场景-高风险代码审计) |
| **代码实现** | 严格按计划执行 | `/implement-plan` | [示例](#场景-按计划实现) |
| **代码实现** | 标准开发任务 | `/implement-standard` | [示例](#场景-标准开发任务) |
| **代码实现** | 快速小修复 | `/implement-lite` | [示例](#场景-快速修复) |
| **工作收尾** | 完整交付物 | `/finalize-work` | [示例](#场景-完整工作交付) |
| **工作收尾** | 快速总结 | `/finalize-lite` | [示例](#场景-快速工作总结) |

---

## 📦 命令总览

### 命令分类图

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Nova Plugin Commands                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   │
│  │ Explore │ → │  Plan   │ → │ Review  │ → │Implement│ → │Finalize │   │
│  └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘   │
│       │             │             │             │             │        │
│  ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐   │
│  │ senior  │   │  lite   │   │  lite   │   │  plan   │   │  work   │   │
│  │ explore │   │         │   │         │   │         │   │         │   │
│  ├─────────┤   ├─────────┤   ├─────────┤   ├─────────┤   ├─────────┤   │
│  │ explore │   │ produce │   │  only   │   │standard │   │  lite   │   │
│  │  lite   │   │  plan   │   │         │   │         │   │         │   │
│  ├─────────┤   ├─────────┤   ├─────────┤   ├─────────┤   └─────────┘   │
│  │ explore │   │ backend │   │ strict  │   │  lite   │                 │
│  │ review  │   │  plan   │   │         │   │         │                 │
│  └─────────┘   ├─────────┤   └─────────┘   └─────────┘                 │
│                │  plan   │                                             |
│                │ review  │                                             |                                             
│                └─────────┘                                             |                                             
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 命令约束强度对比

| 类别 | 命令 | 约束强度 | 输出类型 | 是否写代码 |
|------|-----------------------|-------|---------|----------|
| 探索 | `/senior-explore`     | 🔴 强 | 分析报告 | ❌ 禁止 |
| 探索 | `/explore-lite`       | 🟡 中 | 简要分析 | ❌ 禁止 |
| 探索 | `/explore-review`     | 🟡 中 | 评审问题 | ❌ 禁止 |
| 规划 | `/plan-lite`          | 🟡 中 | 轻量计划 | ❌ 禁止 |
| 规划 | `/produce-plan`       | 🔴 强 | 正式文档 | ❌ 禁止 |
| 规划 | `/backend-plan`       | 🔴 强 | 设计文档 | ❌ 禁止 |
| 规划 | `/plan-review`        | 🟡 中 | 评审意见 | ❌ 禁止 |
| 评审 | `/review-lite`        | 🟢 弱 | 反馈列表 | ❌ 禁止 |
| 评审 | `/review-only`        | 🟡 中 | 分级问题 | ❌ 禁止 |
| 评审 | `/review-strict`      | 🔴 强 | 全面审计 | ❌ 禁止 |
| 实现 | `/implement-plan`     | 🔴 强 | 代码变更 | ✅ 必须 |
| 实现 | `/implement-standard` | 🟡 中 | 代码变更 | ✅ 必须 |
| 实现 | `/implement-lite`     | 🟢 弱 | 代码变更 | ✅ 必须 |
| 收尾 | `/finalize-work`      | 🔴 强 | 交付文档 | ❌ 禁止 |
| 收尾 | `/finalize-lite`      | 🟢 弱 | 简要总结 | ❌ 禁止 |

---

## 🔭 探索类命令详解

### `/senior-explore` — 深度探索分析

#### 📌 命令定位

```
角色：资深工程师 / 技术负责人
目的：深度分析与理解，暴露风险与未知
禁止：设计、重构提案、实现细节、代码、架构推荐
```

#### 📝 参数详解

| 参数 | 必填 | 说明 | 示例值 |
|---------------|---------|------------|-------------------------------------|
| `INTENT`      | ✅ 是   | 分析意图    | `Analyze a new feature requirement` |
| `CONTEXT`     | 🔶 建议 | 上下文材料   | 需求文档、代码路径、日志等 |
| `CONSTRAINTS` | ⚪ 可选 | 分析边界约束 | `Only analyze current implementation` |
| `DEPTH`       | ⚪ 可选 | 分析深度     | `quick` / `normal` / `deep` |
| `EXPORT_PATH` | ⚪ 可选 | 导出路径     | `docs/analysis/xxx.md` |

#### 🎯 输出格式

```markdown
### Key findings
- [事实] 从输入验证的事实
- [推断] 合理推断（与事实明确区分）
- [假设] 信息缺失时的显式假设

### Open questions
- 阻塞理解的关键问题
- 明确说明缺失什么信息

### Potential risks
- 认知/理解风险
- 系统/架构风险
- 运维/运行时风险
```

#### 📚 场景示例库

##### 场景: 新功能需求分析

```text
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT:
- 需求文档: 用户希望在订单详情页添加"一键复购"功能
- 现有接口: POST /api/orders (创建订单)
- 现有接口: GET /api/orders/{id} (订单详情)
- 业务规则: 复购需跳过已下架商品
CONSTRAINTS:
- 只分析需求可行性，不给实现方案
- 基于现有系统架构
DEPTH: normal
```

##### 场景: 生产问题深度排查

```text
/senior-explore
INTENT: Investigate a production issue or bug
CONTEXT:
- 现象: 支付回调偶发重复扣款
- 日志:
  2026-01-10 14:32:15 [WARN] PaymentCallback: duplicate orderId=123456
  2026-01-10 14:32:15 [INFO] PaymentCallback: processing orderId=123456
- 相关模块: com.xxx.payment.callback.*
- 近期变更: PR#4567 (优化回调处理性能)
- 发生频率: 约 0.1% 的回调请求
CONSTRAINTS:
- 只分析当前行为，不讨论重新设计
- 假设当前生产环境行为
DEPTH: deep
EXPORT_PATH: docs/analysis/2026-01-10-payment-duplicate.md
```

##### 场景: 技术选型可行性评估

```text
/senior-explore
INTENT: Evaluate feasibility of a technical choice
CONTEXT:
- 目标: 评估从 MySQL 迁移到 TiDB 的可行性
- 当前数据量: 主表 5000万行，日增 50万
- 现有查询模式:
  - 高频: 按用户ID查询订单列表
  - 低频: 按时间范围的聚合统计
- 现有索引策略: (user_id, created_at) 复合索引
CONSTRAINTS:
- 不比较其他数据库方案
- 只评估迁移风险和兼容性
DEPTH: deep
```

##### 场景: 复杂领域模型理解

```text
/senior-explore
INTENT: Understand a complex data / domain model
CONTEXT:
- 领域: 广告投放系统的归因模型
- 核心实体: Campaign, AdGroup, Creative, Conversion
- 问题: 归因窗口计算逻辑不清晰
- 代码路径: src/attribution/window_calculator.py
CONSTRAINTS:
- 只理解现有逻辑，不建议优化
- 基于代码和注释推断，明确标注不确定处
DEPTH: normal
```

##### 场景: 系统架构审视

```text
/senior-explore
INTENT: Review an existing system architecture
CONTEXT:
- 系统: 订单履约服务
- 架构图: (粘贴或描述)
  [订单服务] → [消息队列] → [履约服务] → [物流服务]
                    ↓
              [库存服务]
- 当前问题: 履约超时率上升
- 监控数据: P99 延迟从 200ms 上升到 800ms
CONSTRAINTS:
- 只分析瓶颈位置，不给优化方案
DEPTH: deep
```

---

### `/explore-lite` — 轻量快速探索

#### 📌 命令定位

```
角色：资深工程师
目的：快速认知对齐，不解决问题
禁止：写代码、方案设计、重构建议
输出：简洁实用
```

#### 🎯 输出格式

```markdown
### Observations
- 从输入得到的事实
- 直接明显的推断（明确标注）

### Uncertainties
- 缺失的信息
- 模糊的行为或意图
- 正在做出的假设

### Potential risks
- 由于误解或未知导致的风险
- 不含解决方案
```

#### 📚 场景示例库

##### 场景: 快速认知对齐

```text
/explore-lite
我们在讨论用户积分系统的改造:
- 现有逻辑: 消费1元=1积分，积分永不过期
- 新需求: 增加积分过期机制（获得后12个月过期）
- 疑问: 历史积分如何处理？

只需要帮我梳理这里有哪些不清楚的地方和潜在风险
```

##### 场景: 快速问题定位

```text
/explore-lite
线上告警:
- 错误: "Connection pool exhausted"
- 服务: user-service
- 时间: 每天 10:00-11:00 高峰期
- 配置: maxPoolSize=50

帮我快速梳理可能的原因方向，不需要解决方案
```

##### 场景: 会议前快速同步

```text
/explore-lite
马上要开需求评审会，帮我快速梳理这个需求的理解:

需求: 支持订单部分退款
- 原系统只支持全额退款
- 需要支持按商品退、按金额退
- 涉及: 订单服务、支付服务、财务服务

只输出：清楚的点、不清楚的点、风险点
```

##### 场景: 代码片段理解

```text
/explore-lite
这段代码的逻辑我有点不确定:
(粘贴或描述)
帮我指出这段代码有哪些我可能没注意到的点
```

---

### `/explore-review` — 评审视角探索

#### 📌 命令定位

```
角色：资深评审者 / 技术负责人
目的：以 Reviewer 心态质询和识别风险
禁止：提供方案、修复建议、实现代码
语言约束：避免 "should/recommend/solution"，使用 "appears/may indicate/is unclear"
```

#### 🎯 输出格式

```markdown
### What is clear
- 基于输入确认的理解
- 明确区分事实与解读

### Review questions
- Reviewer 会提出的问题
- 聚焦正确性、清晰度、假设
- 避免假设性重设计问题

### Risk signals
- 正确性风险
- 边界/边缘案例风险
- 运维/维护风险
- 不含解决步骤
```

#### 📚 场景示例库

##### 场景: 需求文档评审

```text
/explore-review
这是产品给的需求文档，请用 reviewer 视角帮我生成评审问题:

【需求】会员等级自动升降级
- 消费满1000元升级为银卡
- 消费满5000元升级为金卡
- 连续6个月无消费降一级

用 reviewer 心态输出：clear / questions / risk signals
不要给方案
```

##### 场景: 技术方案评审

```text
/explore-review
同事写的技术方案，帮我以 reviewer 视角看看:

【方案】异步消息重试机制
- 使用 RabbitMQ 死信队列
- 重试策略: 1s, 5s, 30s, 5min
- 最大重试 4 次后进入失败队列
- 失败队列人工处理

请输出你作为 reviewer 会关注的问题和风险信号
```

##### 场景: API 设计评审

```text
/explore-review
新设计的 API 接口，请评审:
(粘贴或描述)
只输出评审问题和风险信号，不给修改建议
```

---

## 📐 规划类命令详解

### `/plan-lite` — 轻量执行计划

#### 📌 命令定位

```
角色：资深工程师
目的：产出轻量执行计划，不是正式设计文档
禁止：写生产代码、过度设计、扩展范围
聚焦：明确目标边界、关键决策、实用执行路径
```

#### 🎯 输出格式

```markdown
### Goal
- 计划要达成什么
- 明确的成功标准

### Non-Goals
- 明确不在范围内的内容

### Chosen Approach
- 高层方法
- 关键决策（显式说明）

### Key Trade-offs
- 优先什么
- 有意识地放弃什么

### Execution Outline
- 高层步骤或阶段
- 不含底层实现细节

### Key Risks
- 最重要的风险
- 不需要详细缓解方案
```

#### 📚 场景示例库

##### 场景: 小型任务规划

```text
/plan-lite
目标：修复订阅回调幂等问题

背景：
- /senior-explore 发现回调可能重复处理
- 原因：Redis 锁释放时机问题

约束：
- 不改数据库结构
- 必须向后兼容
- 本周内完成
```

##### 场景: 功能迭代规划

```text
/plan-lite
目标：为用户中心增加"最近浏览"功能

需求：
- 记录用户最近浏览的20个商品
- 支持清空历史
- 跨设备同步

约束：
- 使用现有 Redis 集群
- 不增加新的数据库表
- 接口响应时间 < 50ms
```

##### 场景: 重构任务规划

```text
/plan-lite
目标：将订单状态机从 if-else 重构为状态模式

现状：
- 8个订单状态，15个状态转换
- 分散在3个 Service 类中
- 经常出现状态转换遗漏

约束：
- 分阶段进行，每阶段可独立上线
- 保持现有接口不变
- 必须有完整的状态转换测试
```

---

### `/produce-plan` — 正式设计文档

#### 📌 命令定位

```
角色：资深工程师 / 技术负责人
目的：产出可评审的正式技术决策文档
模式：设计检查点，不是探索步骤
要求：清晰、显式权衡、可追溯
```

#### 📝 参数详解

| 参数 | 必填 | 说明 |
|-----|-----|------|
| `PLAN_OUTPUT_PATH` | ✅ 是       | 计划文档输出路径，缺失则停止 |
| `PLAN_INTENT`      | ✅ 是       | 计划目的描述 |
| `ANALYSIS_INPUTS`  | 🔶 强烈建议  | 引用的分析产物（如 /senior-explore 的结果） |
| `CONSTRAINTS`      | ⚪ 可选      | 约束条件列表 |

#### 🎯 必须包含的章节

```
1. Background & Problem Statement    — 背景与问题陈述
2. Goals & Non-Goals                 — 目标与非目标
3. Constraints & Assumptions         — 约束与假设
4. Alternatives Considered           — 备选方案
5. Final Approach & Rationale        — 最终方案与理由
6. Step-by-Step Implementation Plan  — 分步实施计划
7. Risks & Mitigations               — 风险与缓解
8. Test & Validation Strategy        — 测试验证策略
9. Rollback Strategy                 — 回滚策略
```

#### 📚 场景示例库

##### 场景: 正式设计文档

```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/2026-01-payment-idempotency.md
PLAN_INTENT: 修复支付回调重复处理问题，确保幂等性
ANALYSIS_INPUTS:
- docs/analysis/2026-01-10-payment-duplicate.md
CONSTRAINTS:
- 不修改数据库表结构
- 必须保持 Stripe webhook 吞吐量
- 变更需要灰度发布
- 必须支持回滚
```

##### 场景: 新功能设计

```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/user-points-expiry.md
PLAN_INTENT: 实现用户积分过期机制
ANALYSIS_INPUTS:
- docs/analysis/points-system-current-state.md
CONSTRAINTS:
- 历史积分按获得时间倒推计算过期日
- 过期扫描不能影响核心交易链路
- 用户侧需要过期提醒
- 财务系统需要同步过期数据
```

##### 场景: 系统重构设计

```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/order-state-machine-refactor.md
PLAN_INTENT: 重构订单状态机，提升可维护性和可测试性
ANALYSIS_INPUTS:
- docs/analysis/order-state-complexity.md
CONSTRAINTS:
- 分3个阶段实施，每阶段可独立回滚
- 不改变现有 API 契约
- 必须达到 90% 以上状态转换测试覆盖率
- 整体上线前完成性能基准测试
```

---

### `/backend-plan` — Java/Spring 后端设计

#### 📌 命令定位

```
角色：资深 Java 后端工程师 / 系统设计师
目的：产出 Java/Spring 后端专项设计文档
禁止：写 Java 代码，仅设计
特色：强调事务、一致性、幂等、可观测性
```

#### 📝 必须包含的章节

```
1️⃣  Background & Problem Statement   — 背景与问题
2️⃣  Scope Definition                 — 范围定义
3️⃣  Business Rules & Invariants      — 业务规则与不变量
4️⃣  Architecture Overview            — 架构概览
5️⃣  Data Model & Persistence         — 数据模型与持久化
6️⃣  Transaction & Consistency Design — 事务与一致性设计
7️⃣  Concurrency & Idempotency        — 并发与幂等
8️⃣  Error Handling & Observability   — 错误处理与可观测性
9️⃣  Implementation Plan              — 实施计划
🔟  Testing Strategy                 — 测试策略
1️⃣1️⃣ Rollback & Safety Plan          — 回滚与安全计划
1️⃣2️⃣ Risks & Open Questions          — 风险与待解决问题
```

#### 📚 场景示例库

##### 场景: Java后端设计

```text
/backend-plan
PLAN_OUTPUT_PATH: docs/plans/ads-callback-reporting.md

需求背景:
广告回调上报服务需要处理来自多个广告平台的转化事件

业务规则:
- 同一转化事件不能重复上报
- 上报失败需要自动重试，最多3次
- 需要记录每次上报的结果用于对账

技术约束:
- 使用 Spring Boot 2.7
- 数据库使用 MySQL 8.0
- 消息队列使用 RocketMQ

请设计完整的后端实现方案
```

##### 场景: 支付系统设计

```text
/backend-plan
PLAN_OUTPUT_PATH: docs/plans/refund-subsystem-design.md

需求: 实现订单退款子系统

业务规则:
- 支持全额退款和部分退款
- 退款金额不能超过实付金额
- 已退款金额需要实时扣减可退金额
- 退款需要同步到财务系统

技术背景:
- 现有技术栈: Spring Boot + MyBatis + MySQL
- 支付网关: 支付宝、微信支付
- 需要考虑分布式事务

请输出完整的后端设计文档
```

##### 场景: 库存系统设计

```text
/backend-plan
PLAN_OUTPUT_PATH: docs/plans/inventory-deduction-design.md

需求: 设计高并发库存扣减方案

业务场景:
- 秒杀活动，峰值 QPS 预估 10000
- 需要防止超卖
- 需要支持库存预占和释放

技术要求:
- 使用 Redis 作为库存缓存
- MySQL 作为最终数据存储
- 需要考虑缓存与数据库一致性

请设计完整的技术方案
```

---

### `/plan-review` — 计划评审

#### 📌 命令定位

```
角色：资深评审者 / 技术负责人
目的：评审计划的决策质量和执行风险
禁止：重写计划、提出替代方案、引入新需求
语言约束：避免 should/recommend/solution
```

#### 🎯 输出格式

```markdown
### Decision clarity check
- 目标、范围、选择是否明确？
- 是否有隐含或不清楚的决策？

### Assumptions & gaps
- 计划依赖的假设
- 可能影响执行的缺失信息

### Risk signals
- 技术风险
- 运维/发布风险
- 维护/未来变更风险

### Review questions
- 执行前必须回答的问题
- 不含建议或替代方案
```

#### 📚 场景示例库

##### 场景: 计划文档评审

```text
/plan-review
请评审以下计划文档:

【计划】用户积分过期机制

目标: 实现积分12个月自动过期

方案:
- 每天凌晨3点运行过期扫描任务
- 扫描获得时间超过365天的积分记录
- 批量更新为已过期状态
- 发送过期通知给用户

请只输出评审意见，不要给替代方案
```

##### 场景: 架构方案评审

```text
/plan-review
请评审这个微服务拆分方案:

【方案】将订单模块从单体拆分为独立服务

步骤:
1. 抽取订单相关表到独立数据库
2. 创建订单服务，复制现有代码
3. 修改调用方通过 RPC 调用订单服务
4. 灰度切换流量
5. 下线单体中的订单模块

请用 /plan-review 的结构评审这个方案
```

---

## 🔍 评审类命令详解

### `/review-lite` — 轻量代码评审

#### 📌 命令定位

```
角色：务实的评审者
目的：快速、轻量评审，聚焦明显问题
禁止：写代码、大型重构建议
风格：友好、直接、低摩擦、适合日常 PR
```

#### 🎯 评审聚焦

```
✅ 关注:
- 明显的正确性问题
- 清晰的逻辑 bug 或边缘案例
- 立即可见的过度工程
- 可读性/可维护性红旗
- 危险模式（null、并发误用、静默失败）

❌ 不深入:
- 架构重设计
- 假设性的未来扩展
- 微优化
```

#### 🎯 输出格式

```markdown
### Findings

- [Bug] 问题描述
- [Risk] 风险描述
- [Readability] 可读性问题
- [Overengineering] 过度工程问题

如果没有问题:
**"No obvious issues found in this review scope."**
```

#### 📚 场景示例库

##### 场景: 日常PR评审

```text
/review-lite
这是一个 PR 的关键变更，请快速评审:

@Transactional
public void transferPoints(Long fromUserId, Long toUserId, int points) {
    User from = userRepository.findById(fromUserId).get();
    User to = userRepository.findById(toUserId).get();

    from.setPoints(from.getPoints() - points);
    to.setPoints(to.getPoints() + points);

    userRepository.save(from);
    userRepository.save(to);
}

变更目的: 实现积分转赠功能
只需要高信噪比的反馈
```

##### 场景: 配置变更评审

```text
/review-lite
请评审这个配置变更:

# application-prod.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 50  # 从 20 改为 50
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000

变更原因: 解决高峰期连接不够用的问题
```

##### 场景: SQL 变更评审

```text
/review-lite
请评审这个 SQL 变更:

-- 新增索引
CREATE INDEX idx_order_user_status ON orders(user_id, status);

-- 变更查询
SELECT * FROM orders
WHERE user_id = ? AND status IN ('PENDING', 'PROCESSING')
ORDER BY created_at DESC
LIMIT 20;

目的: 优化用户订单列表查询性能
```

---

### `/review-only` — 常规严格评审

#### 📌 命令定位

```
角色：严格评审者 / 资深工程师
目的：分析和评审，不写代码
维度：正确性、复杂度、性能、并发、错误处理、测试、可维护性
输出：按严重级别分组
```

#### 🎯 输出格式

```markdown
### Critical
- 可能导致: 数据损坏、安全/财务风险、生产不稳定、业务行为错误

### Major
- 显著影响可维护性、可扩展性、正确性
- 可能在现实条件下导致 bug
- 增加长期成本

### Minor
- 影响可读性或一致性
- 最佳实践遗漏
- 低风险但值得处理

每个发现包含:
- 问题描述
- 为什么重要
- 方向性改进建议（不含代码）
```

#### 📚 场景示例库

##### 场景: 核心逻辑评审

```text
/review-only
请 review 这段支付回调处理逻辑:
(粘贴或描述)
要求：按 Critical/Major/Minor 输出，给方向性建议，不写代码
```

##### 场景: 并发代码评审

```text
/review-only
请评审这段并发处理代码:
(粘贴或描述)
这是一个限流器，会被多线程调用
```

---

### `/review-strict` — 高风险穷尽式评审

#### 📌 命令定位

```
角色：资深工程师 / 技术负责人评审者
目的：高风险、穷尽式评审
假设：代码可能运行在生产环境，失败代价高昂
禁止：写代码、实现级修复
```

#### 🎯 强制评审维度

```
- 功能正确性
- 边缘案例和失败模式
- 并发/线程安全
- 性能特征
- 错误处理和可观测性
- 测试覆盖和质量
- 可维护性和可读性
- API/模块边界清晰度
- 长期演进风险
```

#### 📚 场景示例库

##### 场景: 高风险代码审计

```text
/review-strict
这是核心扣费链路代码，请做严格审计:
(粘贴或描述)
要求：穷尽式评审，按 Critical/Major/Minor 输出，解释影响
```

##### 场景: 状态机代码审计

```text
/review-strict
请严格评审这个订单状态机:
(粘贴或描述)
这是订单核心状态流转逻辑，请做全面审计
```

---

## ⚙️ 实现类命令详解

### `/implement-plan` — 严格按计划实现

#### 📌 命令定位

```
角色：纪律严明的软件工程师
目的：严格基于已批准计划的实现
禁止：探索、重新设计、范围扩展
原则：计划是决策权威，执行聚焦
```

#### 📝 参数详解

| 参数 | 必填 | 说明 |
|-----|-----|------|
| `PLAN_INPUT_PATH` | ✅ 是 | 计划文档路径，缺失则停止 |
| `PLAN_APPROVED`   | ✅ 是 | 必须严格等于 `true`，否则阻塞 |

#### 🎯 偏差政策

```
允许偏差的唯一条件:
- 发现明确的 正确性/可行性/安全 问题
- 该问题阻止计划的忠实实现

偏差时必须:
1. 明确解释阻塞问题
2. 描述与计划的具体偏差
3. 说明是否需要更新并重新批准计划
```

#### 📚 场景示例库

##### 场景: 按计划实现

```text
/implement-plan
PLAN_INPUT_PATH: docs/plans/2026-01-payment-idempotency.md
PLAN_APPROVED: true
```

##### 场景: 功能实现

```text
/implement-plan
PLAN_INPUT_PATH: docs/plans/user-points-expiry.md
PLAN_APPROVED: true

补充说明: 优先实现过期扫描任务，通知功能下一阶段实现
```

---

### `/implement-standard` — 标准受控实现

#### 📌 命令定位

```
角色：纪律严明的软件工程师
目的：基于确认的计划或明确步骤实现
规则：不重新设计方案，允许少量纠错调整
阻塞时：停止、解释问题、请求澄清或计划更新
```

#### 📚 场景示例库

##### 场景: 标准开发任务

```text
/implement-standard
按以下步骤实现订单取消功能:

1. 在 OrderService 中添加 cancelOrder 方法
2. 验证订单状态是否可取消（仅 CREATED 和 PAID 可取消）
3. 如果已支付，调用 RefundService 发起退款
4. 更新订单状态为 CANCELLED
5. 发送取消通知给用户

约束:
- 使用现有的状态机逻辑
- 退款走异步处理

遇到阻塞请停止并说明
```

##### 场景: Bug 修复任务

```text
/implement-standard
修复用户积分计算错误的问题:

问题描述:
- 用户消费 99.9 元应该得到 99 积分
- 当前实际得到 100 积分（向上取整错误）

修复步骤:
1. 定位 PointsCalculator.calculate() 方法
2. 将 Math.ceil 改为 Math.floor
3. 添加单元测试验证边界情况

遇到问题请停止说明
```

---

### `/implement-lite` — 快速实现

#### 📌 命令定位

```
角色：高效的软件工程师
目的：快速、务实的实现
规则：基于指令或上下文实现
允许：必要的小设计调整、提升正确性/清晰度的小重构
底线：避免过度工程
```

#### 📚 场景示例库

##### 场景: 快速修复

```text
/implement-lite
需求：把 DaysRangeEnum 的 getByCode 改成 O(1) 并补单测

当前实现是遍历枚举查找，改成 Map 查找

约束：不改 public API
```

##### 场景: 小功能实现

```text
/implement-lite
在用户服务中添加一个获取用户最近登录时间的接口:

- 接口: GET /api/users/{userId}/last-login
- 返回: { "lastLoginAt": "2026-01-10T10:00:00Z" }
- 从 user 表的 last_login_at 字段读取

快速实现即可
```

##### 场景: 工具方法实现

```text
/implement-lite
需要一个手机号脱敏工具方法:

- 输入: 13812345678
- 输出: 138****5678
- 处理 null 和非法格式

放在 StringUtils 类中
```

---

## 📦 收尾类命令详解

### `/finalize-work` — 完整工作交付

#### 📌 命令定位

```
角色：纪律严明的资深工程师
目的：以可评审、可交接的状态关闭工作单元
本质：纯总结和打包，无新决策、无新变更
原则：描述现状，而非改进现状
```

#### 🎯 输出模式

**Case A: 有 Git 仓库**
```markdown
1. 规范的 commit message
   - 格式: type(scope): summary
   - 仅反映实际变更

2. Pull Request 描述
   - What was changed
   - Why it was changed
   - 与批准计划的对应关系（如适用）
   - Known limitations
   - Follow-up work（明确标注为范围外）
```

**Case B: 无 Git 仓库**
```markdown
1. 本地变更总结
   - 适合手动评审
   - 可交接给其他工程师

2. 手动部署或交接步骤
   - 仅应用或验证现有变更的步骤
```

#### 📚 场景示例库

##### 场景: 完整工作交付

```text
/finalize-work

刚刚完成了支付回调幂等性修复的实现，请帮我生成:
- commit message
- PR 描述
```

##### 场景: 无Git项目交付

```text
/finalize-work

完成了配置文件的调整，这是一个没有 Git 的老项目，请生成:
- 变更总结
- 部署步骤
```

---

### `/finalize-lite` — 极简收尾

#### 📌 命令定位

```
目的：总结已完成的工作
禁止：变更、新决策
输出：三要素（What/Why/Limitations）
```

#### 📚 场景示例库

##### 场景: 快速工作总结

```text
/finalize-lite
请对本次修复做三行总结: changed / why / limitations
```

##### 场景: 小任务总结

```text
/finalize-lite
总结一下刚才的工作：
- 修改了什么
- 为什么
- 有什么限制
```

---

## 🔄 工作流模板库

### 工作流 A: 新功能开发（需求不清晰）

```
┌─────────────────────────────────────────────────────────┐
│  1️⃣ /senior-explore
│     → 明确已知/未知/风险（不提方案）
│     → 输出分析报告
├─────────────────────────────────────────────────────────┤
│  2️⃣ /plan-lite
│     → 快速对齐目标、非目标、方法
│     → 轻量计划
├─────────────────────────────────────────────────────────┤
│  3️⃣ /produce-plan （如需正式评审
│     → 写入正式设计文档
├─────────────────────────────────────────────────────────┤
│  4️⃣ /plan-review
│     → 评审问题提前暴露
├─────────────────────────────────────────────────────────┤
│  5️⃣ /implement-plan 或 /implement-standard
│     → 执行实现
├─────────────────────────────────────────────────────────┤
│  6️⃣ /review-only
│     → 代码自查
├─────────────────────────────────────────────────────────┤
│  7️⃣ /finalize-work
│     → 生成 commit + PR
└─────────────────────────────────────────────────────────┘
```

**完整示例:**

```text
# Step 1: 探索需求
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT:
- 需求: 实现用户积分转赠功能
- 现有系统: 积分增减通过 PointsService 处理
CONSTRAINTS:
- 只分析可行性，不给方案
DEPTH: normal
EXPORT_PATH: docs/analysis/points-transfer.md

# Step 2: 轻量计划
/plan-lite
目标: 实现积分转赠功能
输入: docs/analysis/points-transfer.md 的分析结论
约束: 转赠需要双方确认，单次上限1000积分

# Step 3: 正式计划（如需评审）
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/points-transfer.md
PLAN_INTENT: 实现积分转赠功能
ANALYSIS_INPUTS:
- docs/analysis/points-transfer.md
CONSTRAINTS:
- 需要接收方确认
- 单次转赠上限1000积分
- 每日累计上限5000积分

# Step 4: 计划评审
/plan-review
请评审 docs/plans/points-transfer.md

# Step 5: 执行实现
/implement-plan
PLAN_INPUT_PATH: docs/plans/points-transfer.md
PLAN_APPROVED: true

# Step 6: 代码自查
/review-only
请 review 刚才实现的积分转赠功能代码

# Step 7: 收尾
/finalize-work
```

---

### 工作流 B: 线上问题修复

```
┌─────────────────────────────────────────────────────────┐
│  1️⃣ /senior-explore (deep)
│     → 还原事实与假设
│     → 导出分析报告
├─────────────────────────────────────────────────────────┤
│  2️⃣ /plan-lite
│     → 快速确定修复方案
├─────────────────────────────────────────────────────────┤
│  3️⃣ /implement-standard 或 /implement-lite
│     → 快速实现修复
├─────────────────────────────────────────────────────────┤
│  4️⃣ /review-strict
│     → 修复代码严格审查
├─────────────────────────────────────────────────────────┤
│  5️⃣ /finalize-work
│     → 严格收尾
└─────────────────────────────────────────────────────────┘
```

**完整示例:**

```text
# Step 1: 深度排查
/senior-explore
INTENT: Investigate a production issue or bug
CONTEXT:
- 现象: 订单支付成功但状态未更新
- 日志: [粘贴相关日志]
- 发生频率: 约 0.5%
CONSTRAINTS:
- 只分析原因，不给方案
DEPTH: deep
EXPORT_PATH: docs/analysis/payment-status-issue.md

# Step 2: 修复计划
/plan-lite
目标: 修复支付回调后订单状态未更新问题
背景: docs/analysis/payment-status-issue.md
约束:
- 需要支持回滚
- 不能影响正常支付流程

# Step 3: 快速实现
/implement-standard
按以下步骤修复:
1. 在回调处理前添加分布式锁
2. 增加状态更新的重试机制
3. 添加更详细的日志
遇到阻塞请停止说明

# Step 4: 严格审查
/review-strict
请严格审查刚才的修复代码

# Step 5: 收尾
/finalize-work
```

---

### 工作流 C: PR 代码评审

```
根据变更风险选择:

小改动 → /review-lite
核心链路 → /review-only
高风险/并发/金融 → /review-strict
```

---

### 工作流 D: Java 后端完整开发

```
┌─────────────────────────────────────────────────────────┐
│  1️⃣ /senior-explore
│     → 分析需求和现有系统
├─────────────────────────────────────────────────────────┤
│  2️⃣ /backend-plan
│     → 产出完整后端设计文档
│     → 包含事务、幂等、可观测性设计
├─────────────────────────────────────────────────────────┤
│  3️⃣ /plan-review
│     → 设计文档评审
├─────────────────────────────────────────────────────────┤
│  4️⃣ /implement-plan
│     → 严格按设计实现
├─────────────────────────────────────────────────────────┤
│  5️⃣ /review-strict
│     → 高标准代码审查
├─────────────────────────────────────────────────────────┤
│  6️⃣ /finalize-work
│     → 交付物
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 快速参考卡片

### Explore 命令速查

| 命令 | 一句话描述 | 输出结构 |
|-----|----------|---------|
| `/senior-explore` | 深度分析，暴露风险 | Findings / Questions / Risks |
| `/explore-lite`   | 快速对齐理解 | Observations / Uncertainties / Risks |
| `/explore-review` | Reviewer 视角质询 | Clear / Questions / Risk signals |

### Plan 命令速查

| 命令 | 一句话描述 | 输出位置 |
|-----|----------|---------|
| `/plan-lite`    | 轻量执行计划   | 聊天输出 |
| `/produce-plan` | 正式设计文档   | 写入文件 |
| `/backend-plan` | Java 后端设计 | 写入文件 |
| `/plan-review`  | 计划质量评审   | 聊天输出 |

### Review 命令速查

| 命令 | 适用场景 | 深度 |
|-----|---------|-----|
| `/review-lite`   | 日常 PR    | 🟢 轻 |
| `/review-only`   | 核心链路   | 🟡 中 |
| `/review-strict` | 高风险审计 | 🔴 深 |

### Implement 命令速查

| 命令 | 适用场景 | 约束强度 |
|-----|---------|---------|
| `/implement-plan`     | 有批准的计划 | 🔴 强 |
| `/implement-standard` | 明确步骤     | 🟡 中 |
| `/implement-lite`     | 快速小任务   | 🟢 弱 |

### Finalize 命令速查

| 命令 | 适用场景 | 输出内容 |
|-----|---------|---------|
| `/finalize-work` | 完整交付 | commit + PR |
| `/finalize-lite` | 快速总结 | 三要素 |

---

## 📎 附录

### 禁用词汇表

以下词汇在探索/评审类命令中应避免:

| 类别 | 禁用 | 替代 |
|-----|-----|-----|
| 建议类 | should, recommend, suggest | may, could, appears |
| 方案类 | solution, fix, implement   | observation, finding |
| 确定类 | will, must, definitely     | potentially, possibly |

### 常见错误用法

| 错误用法 | 问题 | 正确用法 |
|---------|-----|---------|
| 用 `/senior-explore` 后直接给方案       | 违反"只分析不设计"原则 | 分析完用 `/plan-lite` |
| `/implement-plan` 不提供 PLAN_APPROVED | 会被阻塞              | 必须显式 `PLAN_APPROVED: true` |
| 用 `/review-lite` 审核支付代码          | 深度不够              | 应使用 `/review-strict` |
| `/finalize-work` 时还在改代码           | 违反"冻结现状"原则     | 先完成变更再收尾 |

---

> 📌 **文档维护**: 本文档应随命令更新同步维护
>
> 💡 **使用建议**: 建议收藏本文档，按场景检索对应命令和示例

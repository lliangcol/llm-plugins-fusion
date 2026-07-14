# 深度研究整改与文档体系重新设计方案

Status: active

Snapshot date: 2026-07-14

Snapshot refs: local `HEAD=844067b117bf08682d7ce3ff7f9020c48a68d15b`,
observed `origin/main=e94edef78664ec5a1c90384ba63bf40aa7faa070`

## 1. 目的与结论

本文把深度研究报告中的建议转化为可执行、可验收的仓库修改方案，并将
全项目文档重新设计作为独立工作流。方案不把研究报告当作实时事实源：
所有任务均以执行时的仓库、生成器、校验器、CI 和外部证据为准。

本轮现场核对得到四个直接结论：

1. 必须优先修复评测口径事实漂移。适配器加载的 live 数据集已经包含
   168 个用例，但质量文档、评测说明和质量报告生成器仍把该数据集描述为
   24-case。同时，仓库另有有效的 24-task real-task benchmark；整改必须按
   数据集身份区分两者，不能全局替换数字 `24`。
2. 输入快照观察到的 `origin/main` 已用 assistant manifest、schema、生成器和
   conformance 能力协商实现报告建议的紧凑助手清单；WP0 复核后不应再创建
   第二套清单。
3. shell policy 已具备摘要校验和会话固定，默认校验也已并发执行；这些
   方向应补充回归与文档，不应重复改写。
4. 输入快照中的主要剩余问题是事实源分散、文档重复、诊断接口不统一、
   真实助手证据不足，以及依赖审计缺少持续的机器可读证据。

P0、P1、P2 是按依赖和证据划分的交付波次，不是缺少人员与容量依据的固定
发布周期承诺。任何对外的“已验证”“兼容”或“稳定”声明必须等到相应
证据门实际关闭。

## 2. 输入快照与证据边界

| 项目 | 已核对事实 | 方案中的用法 |
| --- | --- | --- |
| 研究报告 | 392 行，SHA-256 为 685FA80991C60F78EAA1157230DB89A2ACB8E42D985A4DEDBAE46C6A23BD70FB | 作为建议清单，不作为当前实现事实 |
| 本地基线 | 2026-07-14 核对时，本地 `main` 为 `844067b`，观察到的 `origin/main` 为 `e94edef`，相差 4 个提交；在新增本文及 `docs/README.md` 索引项前工作树干净 | 实施前先重新 fetch，并从当时最新远端主线创建隔离分支或 worktree |
| 当前库存 | 21 commands、6 canonical skills、6 active agents、8 packs | 继续从权威源生成，不手工复制计数 |
| 文档规模 | 在新增本文及索引项前，全仓库 243 个 Markdown、24,238 行；`docs/` 下 90 个 Markdown、97 个文件 | 仅作为带范围的输入快照；迁移必须重新自动盘点且不遗漏 |
| 评测口径 | `evals/live/cases.json` 有 168 个用例，单助手、两种 condition、三次 attempt 的 paired plan 为 1,008 次；`benchmarks/real-tasks.json` 另有 24 个任务、两种助手、三种 condition、三次 attempt，计划为 432 次 | 修正把 live 数据集写成 24-case 的当前文档，同时保留 24-task benchmark 和明确标期的历史快照 |
| 默认校验 | validate-all 通过，failed=0、skipped=1；Bash 实际运行，Claude CLI 检查跳过 | 跳过项不得写成通过 |
| 文档校验 | validate-docs 通过，但未发现 168 与 24 的矛盾 | 校验规则需要从事实源生成并增加语义一致性检查 |
| 远端增量 | 观察到的 `origin/main` 包含 assistant manifest schema、生成清单与能力协商 | 基于重新 fetch 后的最新主线实施，避免重复设计 |

快照复核边界：文件盘点使用 `rg --files -uu`，排除 `.git/`、`.codex/`、
依赖目录、构建输出、IDE 目录、缓存、日志和临时/runtime artifacts；评测计划
分别由 `node scripts/evaluate-paired-live.mjs --dry-run` 与
`node scripts/run-real-task-benchmark.mjs` 输出；仓库与文档门分别由
`node scripts/validate-all.mjs` 和 `node scripts/validate-docs.mjs` 观察。

以上数字仅描述带日期、ref 和范围的输入快照，其中文档规模刻意排除了
本文及其索引行，避免自引用计数。进入实施后，WP0 必须重新生成同类快照，
并用新的基线替代执行台账中的静态数字；不得把本节数字继续当作当前事实。

### 2.1 实施台账

本节是本方案的唯一实施台账。状态只使用 `implemented`、`partial`、`open`、
`external-evidence` 或 `rejected`；验证结果继续单独区分 Passed、Skipped、
Blocked、Not verified 和 External evidence。

实施基线（2026-07-14）：

- 原工作树（本机路径不写入公共仓库）：分支 `feature/20260715`，
  `HEAD=09a92f433311c1a75969ebe8267d2df669a3fb9d`，
  staged、unstaged 和 untracked 均为空。
- fetch 后默认主线：`origin/main`，
  `BASE_COMMIT=e94edef78664ec5a1c90384ba63bf40aa7faa070`。
- 隔离 sibling worktree（本机路径不写入公共仓库）：分支
  `feature/deep-research-docs-remediation-20260714`。任务专属方案与
  `docs/README.md` 单行索引通过经审查的提交迁入；没有携带其他文件。
- 排除 `.git/`、`.codex/`、`.metrics/`、`.nova/`、依赖、构建输出、IDE、
  缓存、日志和临时/runtime artifacts 后，实时树为 622 个文件、244 个
  Markdown；`docs/` 下 98 个文件、91 个 Markdown。迁移 manifest 将在
  批次 A 从实时树重新生成。
- 工具：Node `v24.16.0`、npm `11.13.0`、Bash `5.3.9`、Claude CLI
  `2.1.207`、Codex CLI `0.144.1` 可从交互 shell 启动。修改前
  `validate-all` 的隔离子进程未识别 Claude/Codex CLI，因此 Claude 静态
  兼容检查为 Skipped；Bash hook/runtime 检查实际运行并通过。
- 修改前门：`npm ci --ignore-scripts` 成功且报告 0 vulnerabilities；
  `node scripts/validate-all.mjs` 为 failed=0、skipped=1。该结果只作为实施前
  基线，不作为后续提交或 clean-checkout 的通过证据。
- 版本图对账：`framework.json` 拥有 framework v5；
  `workflows.v6.json`/`behaviors.v2.json` 是当前 typed/behavior-complete IR；
  `workflows.json`/`behaviors.json` 是兼容窗口中的 v5/v1 投影输入。
  `CLAUDE.md` 的 workflow schema v5 指生成 project-state 的兼容投影视角，
  Codex adapter 的 workflow 6.0.0 指 adapter 使用的 v6 契约，不构成规范冲突。

| 工作包 | 状态 | 当前事实、证据与边界 | 变更/生成输出 | 验证、残余风险与回滚 |
| --- | --- | --- | --- | --- |
| WP0 | implemented | fetch 成功；基于最新 `origin/main` 建立隔离分支；原工作树无既有脏改动 | 本台账 | 修改前 `validate-all` failed=0、skipped=1；回滚为删除任务分支/worktree，不触碰原工作树 |
| WP1 | implemented | `live-paired` 从 168 cases 推导 1,008 次；`real-task-benchmark` 从 24 tasks 推导 432 次；历史 24-case 快照保留日期和证据语义 | evaluation facts、project-state、fact graph、质量报告及同步块 | targeted tests、schema、docs、生成器二次写入与 drift check 通过；真实助手结果仍属外部门 |
| WP2 | open | doctor、llmf、validate-all 与 install dry-run 尚未共享统一 diagnostics schema/registry | 待实施 | 不得把 CLI 缺失写成 Passed |
| WP3 | open | assistant manifest 与 v6/v2 生成链已存在；文档 metadata、命令文档和导航生成链尚缺 | 待实施 | 保持六技能/21 命令行为不变 |
| WP4 | open | 实时文档迁移 manifest 尚未生成 | 待实施 | 所有旧公共路径默认保留 stub |
| WP5 | open | Dependency Review 和 dependency policy 已存在；定期机器可读审计证据尚缺 | 待实施 | 网络证据不可用时必须为 Blocked/External evidence |
| WP6 | partial | 168-case 数据集、8-case critical profile、runner 与 24-task benchmark 已存在；分层 profile/evidence manifest 尚不完整 | 待实施 | 凭据型 live eval 未授权，保持 External evidence |
| WP7 | partial | shell digest/session pinning、audit spool/lock、validate-all 并发已存在 | 待补竞态、恢复与性能预算证据 | 平台 skip 不能替代持续门 |
| WP8 | partial | deterministic demo fixtures 与 minimal consumer fixture 已存在 | 待建立单一教程路径和 smoke | 不新增第二份 consumer fixture |
| WP9 | partial | release evidence、checksums 与 adoption ledger 已存在 | 待整合生成摘要与定位文档 | 发布、签名、真实安装均为外部门 |
| WP10 | open | 迁移尚未开始 | 待实施 | 本轮禁止删除公共兼容 stub、改版本或发布渠道 |

| 报告方向 | 状态 | 工作包与实时决策 |
| --- | --- | --- |
| 统一新手入口与一键演示 | partial | WP2/WP8；现有两个 demo，待增加安全的聚合入口和教程 |
| 贡献者检查聚合 | implemented | WP2；保留现有唯一 `npm run check`，仅核对覆盖面 |
| bootstrap 校验 | open | WP2；新增只读入口并复用 reason registry |
| 机器可读诊断 | open | WP2；统一 schema、状态与 reason code |
| Commands、Skills、Docs、Runtime 生成 | partial | WP3；运行时链已实现，命令文档和导航待接入 |
| 紧凑执行清单 | implemented | WP3；复用现有 assistant manifest，拒绝第二套清单 |
| 依赖与供应链自动证据 | partial | WP5；PR 门已存在，定期审计摘要待实现 |
| 扩大 live eval | partial | WP1/WP6；数据集已扩大且事实漂移已修，真实运行仍为外部门 |
| Windows/Bash 诊断 | partial | WP2；doctor 有平台检查，统一 JSON/remediation 待实现 |
| 中文失败矩阵 | open | WP2；必须从 reason registry 生成 |
| 教程与 showcase | partial | WP8；fixtures 已存在，教程与 CI smoke 待整合 |
| 发布摘要模板 | partial | WP9；现有证据模板待生成式整合 |
| shell policy 锁定 | partial | WP7；现有摘要和会话固定，竞态回归待补 |
| 校验性能 | partial | WP7；并发和 timings 已存在，可比较预算待补 |
| 审计与并发 | partial | WP7；spool/compaction/lock 已存在，压力与恢复证据待补 |
| 竞品定位 | partial | WP9；当前定位正确，双语入口和 ROADMAP 待收敛 |
| 多插件生态与门户 | rejected | 证据不足，保持 deferred；不在本轮实现 |

| 文档批次 | 状态 | 当前边界 |
| --- | --- | --- |
| A 治理基础 | open | metadata、source registry、redirect map、manifest 与导航待实现 |
| B 入口与事实 | open | 等待 WP3 和批次 A |
| C 教程、指南与模板 | open | 等待批次 A/B |
| D 参考、项目与发布 | open | 等待批次 A |
| E 插件与就近文档 | open | 等待 WP3 文档生成链 |
| F 迁移收口 | open | 只保留/验证 stub，不执行未授权 URL 删除 |

## 3. 范围与非目标

范围包括：

- 研究报告涉及的安装、诊断、架构、生成链、依赖安全、评测、性能、
  并发与审计、开发体验、发布证据和社区采用。
- 根目录所有面向人的文档。
- docs 下全部文件。
- nova-plugin/docs 下全部文档，以及 commands、skills、agents、packs、
  adapters、evals、framework、workflow-specs 等就近文档。
- 与文档事实、目录、生成和校验直接相关的 schema、脚本、测试和 CI。

非目标包括：

- 不扩展为多插件门户，不新增与证据无关的产品表面。
- 不重做已经存在的 assistant manifest 或 shell policy。
- 不把真实消费者名称、地址、端点、凭据和业务规则放入公共仓库。
- 不以文档重构为理由改变 Workflow IR 或运行时语义。
- 不把需要凭据、真实安装、签名密钥或外部助手调用的验证伪装成本地通过。
- 不重写 LICENSE 的法律文本；如需变更必须走独立法律审阅。

## 4. 报告建议与当前状态对账

| 报告方向 | 当前分类 | 决策 |
| --- | --- | --- |
| 统一新手入口与一键演示 | 部分存在 | 增加 `demo:all` 与单一入口页 |
| 贡献者检查聚合 | 已有 `npm run check`，且生成任务目录已经收录 | 复用并说明现有入口；只有证据表明范围不足时才扩展其实现，不新增同义 `check:contrib` |
| bootstrap 校验 | 分散存在 | 增加 `validate:bootstrap`，复用 doctor 的稳定 reason code |
| 机器可读诊断 | 两套接口且字段不一致 | 统一 diagnostics schema，文本输出由 JSON 渲染 |
| Commands、Skills、Docs、Runtime 进一步生成 | 21 个 command wrapper、Skill 中的行为块和 runtime contracts 已生成；Skill 解释性正文与 63 份命令文档仍需人工同步 | 保留行为源边界，增加命令文档和导航生成链 |
| 紧凑执行清单 | 输入快照观察到的 `origin/main` 已实现 | WP0 重新确认后复用 assistant manifest，不创建第二套格式 |
| 依赖与供应链自动证据 | PR Dependency Review 已强，定期 npm audit 证据不足 | 增加定期审计、基线和摘要产物 |
| 扩大 live eval | live 数据集已扩至 168，但当前说明仍混用旧 24-case 口径且实跑证据仍薄 | 先按数据集身份修复文档漂移，再分层运行和发布证据 |
| Windows/Bash 诊断 | doctor 已覆盖很多检查 | 补 JSON、reason code、修复建议与平台矩阵 |
| 中文失败矩阵 | 已有 Fast Failure Map | 从 reason registry 生成，不维护第二张手工表 |
| 教程与 showcase | 有描述页和静态示例 | 改为确定性、可运行、可验证的教程 |
| 发布摘要模板 | 有证据模板但入口分散 | 合并为发布操作包与自动摘要 |
| shell policy 锁定 | 已有摘要和会话固定 | 增加篡改、竞态和跨平台回归 |
| 校验性能 | 默认校验已有并发 | 保留并发，建立时序基线与退化预算 |
| 审计与并发 | 已有 spool、compaction 与锁 | 只补压力测试和恢复证据 |
| 竞品定位 | 报告建议合理 | README 和 ROADMAP 明确“工作流框架”边界 |
| 多插件生态与门户 | 证据不支持 | 保持规划状态，不作为本轮交付承诺 |

### 报告章节覆盖矩阵

| 报告章节 | 本方案落点 | 完成证据 |
| --- | --- | --- |
| 执行摘要 | 第 1、4、5 节 | 建议均有状态、优先级和退出条件 |
| 仓库概览与代码文档审查 | WP0、WP1、WP3、WP4 | 新基线、单一事实源、生成链和全量迁移清单 |
| 可运行性与复现结论 | WP2、WP8 | demo:all、bootstrap、`npm run check`、可运行教程 |
| 架构与设计评估 | WP3、WP7 | 复用 manifest、skill-first 投影、契约和竞态回归 |
| 性能与资源使用分析 | WP7 | 任务时序、关键路径、基线和退化预算 |
| 安全与依赖风险 | WP5、WP7 | 定期依赖证据、secret/policy/audit 回归 |
| 开发者与用户体验 | WP2、WP4、WP8 | 统一诊断、任务式信息架构、首次贡献闭环 |
| 同类项目对比与定位 | 第 3 节、WP9 | README/ROADMAP 保持 workflow framework 定位 |
| 高中低优先级路线图 | 第 5、6 节 | P0/P1/P2 和 WP0 至 WP10 |
| 三个建议补丁 | WP2、WP3 | 聚合入口、生成故障矩阵、复用现有 assistant manifest |
| 关键修复测试设计 | 各工作包验收、第 15 节 | unit、integration、e2e、CI、外部门分层 |
| 发布与维护建议 | WP9、WP10 | 用户摘要、exact-tag 边界、发布证据和兼容迁移 |
| 文档模板、示例与社区 | WP4、WP8、WP9 | 模板体系、fixture 教程、issue 路径和采用指标 |

## 5. 优先级与交付波次

### P0：先恢复事实可信度

- WP0 基线冻结与远端同步。
- WP1 修复 168-case live 口径漂移，同时保护有效的 24-task 与历史快照语义。
- WP2 建立统一诊断契约。
- WP3 建立文档元数据、生成和路径迁移基础。

退出条件：本方案涉及的版本、库存、评测口径、默认/外部门和兼容等级等
机器事实各有唯一权威源，生成后无差异，已识别的旧事实残留为零。

### P1：降低维护成本并补齐证据

- WP4 执行文档目录重构和全量重写。
- WP5 自动化依赖与供应链证据。
- WP6 扩大分层 live eval 和真实任务证据。
- WP7 加固安全、审计、竞态与性能回归。

退出条件：所有文档有归属、有读者、有状态；默认门、定期门和外部门的
证据边界明确。

### P2：采用、教程与发布沟通

- WP8 建立可运行教程和贡献者路径。
- WP9 整合发布摘要、社区采用和度量。
- WP10 完成迁移兼容期与最终收口。

退出条件：新用户、贡献者和维护者都能从一个入口完成最短闭环；保留中的
旧公共链接没有断链，任何 stub 删除均通过独立 URL 退出审查。

硬依赖：WP1 在 WP0 后执行；WP4 依赖 WP3 的 metadata 与生成基础；WP5 的
状态语义依赖 WP2；WP6 依赖 WP1 的评测身份与事实源；WP8/WP9 复用 WP3/WP4
形成的导航和事实片段；WP10 只在其余工作包达到各自退出条件后收口。没有
硬依赖的验证、威胁建模和 fixture 准备可以并行，但不得越过相应证据门。

## 6. 报告整改工作包

### WP0：冻结新基线并建立任务台账

目标：保证后续修改基于实施时重新观察到的最新主线，而不是本节记录的
落后四个提交的本地快照。

修改：

1. 先 fetch 并复核工作树；从当时最新 `origin/main` 创建隔离 feature 分支
   或 worktree，不直接推进落后的本地 `main`，也不覆盖既有未提交改动。
2. 记录 HEAD、上游 HEAD、版本、Node/Bash/Claude/Codex 可用性、文件库存、
   生成状态、默认校验结果和跳过项。
3. 生成报告覆盖台账，每一项标记为 implemented、partial、open、
   external-evidence 或 rejected。
4. 把任务台账放入当前整改计划或 WP4 建立的 active plan，不创建新的
   `docs/reports/` 或 `nova-plugin/docs/history/` 历史树。
5. 按可独立验收、回滚的变更单元提交；一个工作包可以拆成多个提交或 PR，
   但生成文件必须与对应源文件在同一个变更单元中更新。

验收：

- 分支基于实施时重新 fetch 后的最新 `origin/main`，原工作树改动已保留且
  未混入实施分支。
- 每个变更单元结束时 `git status` 可解释，计划提交的工作树干净，所有
  相关生成器 drift check 通过。
- 报告每一条建议都有唯一工作包或明确的不实施理由。

### WP1：修复事实漂移并建立单一事实源

目标：立即消除 live 数据集已经是 168-case、当前 prose/生成器仍写成
24-case 的矛盾，同时保留独立 24-task benchmark 和明确标期的历史
24-case 快照，并让计数、版本、命令、兼容级别和评测规模不再由 prose
手工维护。

修改：

1. 从 `evals/live/cases.json` 推导 live 数据集规模、语言分布、对抗用例、
   审批用例、profile 规模和 paired invocation 计划；从
   `benchmarks/real-tasks.json` 独立推导 real-task 规模和计划。
2. 修改质量报告生成器、`evals/README.md`、质量基准和仍表示“当前状态”
   的维护者文档；明确的历史快照保留原值、日期和证据来源，不改写历史。
3. 扩展现有 `governance/facts.generated.json`、project-state 和
   `sync-doc-facts` 链路，为文档提供可嵌入事实，至少包含版本、库存、按
   数据集 id 区分的评测规模、默认门、外部门和助手兼容级别；不创建平行
   `machine-facts` 事实图。
4. 在 validate-docs 中增加“事实引用必须来自生成片段或明确标为历史快照”
   的规则。
5. 对 README、CLAUDE、AGENTS、质量文档和发布文档做带语义的残留搜索；
   不以搜索裸数字 `24` 代替数据集身份检查。

产物：

- 扩展后的 `governance/facts.generated.json` 及现有事实同步链。
- 更新后的质量报告生成器及快照测试。
- 跨文档事实一致性测试。

验收：

- 168 和 1,008 由 live 数据与计划参数计算；24 和 432 由 real-task 数据与
  计划参数独立计算，不由模板常量写入。
- 把 live 数据集误写成 24-case 的非历史残留为零；有效的 24-task 和明确
  标期的 24-case 历史快照仍被测试保护。
- 在不改变权威数据源的情况下篡改当前文档、模板或生成片段中的用例数时，
  单元测试或 validate-docs 必须失败；合法数据集变更则要求重新生成事实。

### WP2：统一安装、bootstrap 与诊断契约

目标：把 doctor、llmf doctor、validate-all 和 install smoke 的诊断变成
同一套稳定、可解析、可链接到修复文档的结果。

修改：

1. 新增 diagnostics schema。`schemaVersion`、`command`、`status`、
   `reasonCode`、`severity`、`platform` 和 `check` 为稳定核心字段；
   `expected`、`actual`、`remediation`、`docsUrl`、`evidencePath` 和
   `skippedReason` 按结果类型出现，避免用空值伪造证据。
2. 建立 reason-code registry。CLI 文本、JSON、失败矩阵和故障排查页面
   都从该注册表派生。
3. 为 doctor、llmf doctor、validate:bootstrap、validate-all summary 和
   plugin install dry-run 提供一致的 --json 或 --output-json 行为。
4. 增加只读的 `npm run validate:bootstrap`，检查最低 Node、lockfile 与已
   安装工具链状态、Bash 能力、可选 CLI、写保护和生成漂移。该 validator
   不得自行运行 `npm ci` 或改写用户环境；安装步骤单独记录。
5. 增加 npm run demo:all，按 dry-run 默认执行路由、审查与安装预览；
   任何用户级变更仍需显式危险开关。
6. 保持 `npm run check` 为唯一贡献者聚合入口；核对其是否覆盖格式、lint、
   测试、docs/schema/surface drift 和最小 runtime smoke。若要扩展范围，
   同步更新 `package.json`、任务注册表、生成目录和贡献者文档。
7. 让退出码与 JSON status 一致；skip、warn、blocked、failed 不互相代替。
8. Issue 模板接受已经脱敏的诊断 JSON、artifact 链接或粘贴内容；模板本身
   不宣称具备解析能力。若需要自动提取 `reasonCode`、平台、版本和跳过项，
   由单独的只读 triage 脚本或 workflow 完成，并对本机路径、环境变量和
   凭据再次脱敏。PR 模板从任务注册表生成最小验证清单，避免复制全部门。

验收：

- Windows PowerShell、Bash 和 Linux CI 对语义等价的故障产生相同
  `reasonCode`；平台专属故障可以不同，且 remediation 可以按平台变化。
- 无 Claude CLI 时结果为 skipped 或 blocked，不是 passed。
- demo:all 默认不写用户级目录、不需要真实凭据。
- `npm run check` 仍是唯一贡献者聚合入口，任务目录与文档无漂移。
- 所有诊断 reasonCode 都有测试和一个文档锚点。

### WP3：把技能、命令、文档和运行时投影接到同一生成链

目标：降低 21 个命令包装器、63 个命令文档、导航和运行时清单的同步成本，
同时保持运行时 IR、Skill 行为和人类叙事的权威源边界。

修改：

1. 保留现行生成链：`framework.json`、`nova.product.json`、
   `workflows.v6.json` 和 `behaviors.v2.json` 分别拥有框架、产品库存、工作流
   契约与行为 IR；`workflows.json` 和 `behaviors.json` 只在兼容窗口内作为
   v5/v1 投影输入。生成器继续拥有 runtime contracts、Skill 行为块和
   21 个 command wrapper，Skill 的非生成解释性正文不得覆盖生成行为。
2. 将 assistant manifest 作为通用助手的执行清单，不引入平行 manifest。
3. 建立 schema-governed、以 workflow id 为键的文档元数据源，记录读者、
   示例和 related workflows；阶段、变体、输入、输出、写入边界、审批点和
   支持级别继续从各自运行时或兼容性权威源读取，不把纯文档字段塞回运行时
   IR，也不复制机器事实。
4. 新增命令文档生成器，生成每个命令的中文说明、英文说明和短参考页。
5. 新增导航生成器，生成命令矩阵、阶段索引、相关命令和文档目录。
6. 把 validate-docs 中与路径、标题、固定数字有关的硬编码规则逐步迁移到
   schema、metadata 和生成清单。
7. 生成文件顶部写入源文件和生成命令；禁止直接编辑。
8. 增加 round-trip、determinism、generated-drift、missing-doc 和 orphan-doc
   测试。

验收：

- 修改一个 workflow id、variant、权限或行为后，所有适用的 runtime
  contract、Skill 生成块、command wrapper、command docs、assistant
  manifest 和导航都能按一条有文档记录的生成序列同步；解释性 Skill 正文
  由冲突校验保护，而不是被静默重写。
- 第二次运行生成器无差异。
- 任意遗漏一份命令文档或导航项都会使默认门失败。
- 生成链不改变六技能、21 命令的行为语义。

### WP4：执行全项目文档重新设计

WP4 的完整信息架构、逐目录迁移、重写规范、批次和验收见本文第 7 至 15 节。
它必须在 WP3 的元数据和路径治理能力就绪后分批实施。

### WP5：自动化依赖与供应链证据

目标：在现有 Dependency Review、Dependabot、锁文件和发布校验基础上，
补足持续、可读、可追踪且按可达风险分类的依赖与供应链证据。

修改：

1. 新增定期和手动 dependency-audit 工作流，使用锁定版本的工具运行
   npm audit 或 OSV 等等价扫描。
2. 将发现分为 direct、transitive、dev-only、runtime-distributed 和
   archive-excluded，避免把维护工具依赖误写成分发运行时依赖。
3. 建立可审阅的例外基线：漏洞、受影响范围、理由、负责人和到期日。
4. 生成 JSON 与 Markdown 摘要；PR 仅显示增量，定期任务保留完整证据。
5. 发布门以 `governance/dependency-policy.json` 和实际可达执行/分发路径为
   准，校验未获有效例外的高危 direct 或 transitive 风险、lockfile 完整性、
   provenance、artifact digest 和 Dependency Review 结论；不能仅因漏洞是
   transitive 或 dev-only 就自动降级。
6. 不在分发归档中加入 Node runtime dependency。

验收：

- 无网络或服务不可用时使用 WP2 注册表定义的外部服务 blocked 状态与稳定
  reason code，不写成 clean，也不在 WP5 另造状态词汇。
- 新增达到政策阈值且影响维护、构建、发布或分发路径的依赖风险会阻止
  相应门。
- 例外过期会失败，且摘要不泄漏凭据或本机路径。

### WP6：分层 live eval 与真实任务证据

目标：把“有大数据集”和“已在真实助手上验证”严格分开，并按成本分层。

修改：

1. 保留 168-case full live 数据集，并定义 critical、PR、nightly、release
   和 manual profiles。相同语义的用例应通过 canonical case id 或标签查询
   复用，不复制完整对象；`evals/critical-live/` 等若因 schema 或执行语义
   不同而继续独立存在，必须记录理由和交叉覆盖关系。
2. PR 运行确定性静态与 runner 计划检查；nightly 运行可负担的模拟或已授权
   助手子集；release/manual 才运行完整外部矩阵。
3. 每次运行记录 assistant、version、model、platform、mode、attempt、
   dataset hash、prompt hash、退出码、成本、时长和 redaction 状态；CLI
   无法可靠报告的 model、token 或 cost 必须记为 unavailable，不得猜测。
4. 将当前两条裸 CLI 证据标为 legacy/minimal，不据此提升完整兼容等级。
5. 对 24-task real-task benchmark 明确 432 次计划调用与实际完成比例。
6. 增加失败聚类、回归阈值、置信区间和 flake 重试规则；重试不得丢弃首次
   失败，所有 attempt 都进入不可变原始证据，原始证据与汇总分离。
7. 只有满足 assistant-levels 中的证据要求，才更新 compatibility 声明。

验收：

- 计划调用数由 case/profile/attempt/condition 计算。
- 文档同时显示 planned、executed、passed、skipped、blocked。
- 不具备凭据时本地门仍可运行，但不会生成伪 live evidence。
- 任一兼容等级变化都能追溯到不可变 evidence manifest。

### WP7：安全、审计、并发与性能回归

目标：验证已经存在的保护机制，并只修复有证据的薄弱处。

修改：

1. 为 secret scanner 增加每条规则的正例、反例、编码变体和大文件回归。
2. 为 shell policy 增加摘要篡改、会话固定、并发更新、符号链接、路径大小写
   和 Windows/Linux 差异测试；不另建签名格式，除非威胁模型证明必要。
3. 为 audit spool、compaction 和锁增加多进程压力、崩溃恢复、半写文件、
   重放幂等和保留策略测试。
4. 保留 validate-all 的并发分组，输出每个任务的 wall time、cache 状态和
   关键路径；CPU time 仅在运行时和平台能够可靠采集时输出，否则明确标为
   unavailable。
5. 建立可审阅的性能基线和退化阈值；只有超过预算才做缓存或并行度调整。
6. 对 prompt surface 使用现有预算报告，区分可加载上下文与仓库总文档量。
7. 复核 best-effort redaction 的边界，在安全文档中明确不保证自动消除所有
   敏感信息。

验收：

- 竞态和崩溃测试进入 Linux 与 Windows 的持续或定期 lane；平台能力导致的
  skip 必须有 reason code、替代证据和后续门，不能以一次手工通过代替。
- 性能优化前后有同一机器或同一 CI runner 的可比证据。
- 安全门失败时默认 fail closed；外部服务不可用时状态可区分。

### WP8：可运行教程与贡献者体验

目标：把描述性 showcase 转成新用户可以复制、运行、验证和清理的教程。

修改：

1. 建立 Java 后端、前端、发布与文档、工作流评测四条教程。
2. 每条教程使用公共 fixture，包含预期输入、命令、生成差异、验收与清理。
3. 在 CI 中运行教程的非凭据路径，防止命令和截图过期。
4. CONTRIBUTING 提供从 bootstrap、选择变更类型、运行最小门到提交 PR 的
   一条路径，并链接 `npm run check`。
5. 从低风险生成器、文档契约和 fixture 任务建立 good-first-issue 模板。
6. 复用并扩展现有 `fixtures/consumer/minimal`，将其文档化为最小 consumer
   profile 示例，覆盖 public-safe profile、assistant manifest 消费、fallback
   和验证；不再复制第二份 fixture，也不包含真实消费者信息。
7. 保留中文主入口和英文入口，但机器事实与命令表由同一源生成。

验收：

- 新克隆仓库在无用户级写入条件下可以完成至少一条教程。
- 教程命令在 CI 中实际执行，预期输出采用语义断言而非整段脆弱快照。
- showcase 不再复制架构、命令清单或兼容声明。

### WP9：发布摘要、定位与社区采用

目标：让每次发布清楚说明改了什么、证据是什么、哪些事项仍未验证。

修改：

1. 从 release channels、CHANGELOG、surface diff、compatibility diff、
   evidence manifest 和 artifact digest 生成发布摘要草稿。
2. 摘要固定区分 Verified、Not verified、Skipped、External evidence 和
   Residual risk。
3. README、README.en.md 和 ROADMAP 统一定位为多助手工作流框架，不宣称
   成熟多插件生态或公共门户。
4. growth 指标只记录可审计来源；stars、forks、issues、downloads 与
   live-eval 证据分开。
5. 对 exact-tag、稳定渠道、安装 smoke 和签名结论继续使用已有证据门。

验收：

- 发布摘要中的版本、tag、digest、兼容等级均由源数据生成。
- 没有 exact tag 或真实安装证据时，摘要不能出现相应成功声明。
- 社区指标不进入产品正确性或安全性结论。

### WP10：集成、迁移兼容与最终收口

目标：在不破坏稳定 URL、插件分发和生成链的情况下完成迁移。

修改：

1. 按第 14 节的批次执行，不做一次性大爆炸移动。
2. GitHub Markdown 没有仓库级 HTTP redirect 能力。对有外部链接价值的旧
   路径保留兼容 stub；删除 stub 必须是独立、显式授权的破坏性 URL 决策，
   有内部引用清零、外部影响评估和发布说明，不能只因经过一个 MINOR 周期
   就自动删除。生成文件的稳定路径按公共 API 变更流程处理。
3. 每个批次执行链接、锚点、孤儿页、生成漂移、distribution scan 和
   package inventory 检查。
4. 最后一批只删除满足上述独立退出条件的临时迁移页；无法观测外部引用时
   继续保留兼容 stub，不把“没有站点日志”当作“没有用户”。
5. 更新版本或发布渠道只在语义变化和发布授权明确时进行。

最终门：

- `npm ci --ignore-scripts`（环境准备，会改写本地依赖目录，不计为只读校验）
- `npm run check`
- `npm run ci:full`（即 `node scripts/validate-all.mjs`，不重复执行同一门）
- `node scripts/validate-plugin-install.mjs --dry-run`
- `node scripts/generate-registry.mjs` 的 drift check
- `node scripts/generate-surface-inventory.mjs` 的 drift check
- Windows 上实际运行 `scripts/verify-agents.ps1`
- `git diff --check`
- clean checkout 重跑默认门

Bash 依赖检查只有在 Bash 实际运行时才记为 passed。真实安装、发布、签名、
外部助手和采用指标继续作为独立外部门。

## 7. 文档重新设计：目标与原则

文档重新设计不是移动文件，而是重新建立读者、任务、事实源、生命周期和
生成边界。目标是让用户从“我要完成什么”进入，而不是先理解仓库目录。

原则：

1. 普通任务页只服务一个主要读者和一个主要任务；导航首页、索引和跨角色
   policy 页面可以有多个受众，但必须明确路由。
2. 教程、操作指南、参考资料、维护操作和项目记录分层，互不混写。
3. 根目录只保留 GitHub 和工具会自动发现的稳定入口。
4. 机器事实、命令表、兼容矩阵和库存由源数据生成。
5. 历史事实放 CHANGELOG、Git tag、GitHub Release、不可变 evidence
   manifest 或迁移页；不创建 `docs/reports/` 或
   `nova-plugin/docs/history/`。
6. 运行时契约文档靠近代码，但公共导航只在 docs 维护一个入口。
7. 中文与英文可以采用不同叙事，但不得各自维护数字、命令或版本。
8. 任何移动都先有 redirect map、链接检查和兼容 stub；redirect map 是治理
   清单，不等同于 GitHub 的真实 HTTP redirect。

## 8. 文档读者与内容类型

| 读者 | 首要问题 | 主入口 | 内容类型 |
| --- | --- | --- | --- |
| 首次用户 | 如何安全体验一次完整流程 | README 到 getting-started | 教程 |
| 日常用户 | 该选哪个 workflow，输入输出是什么 | guides 与 command reference | 操作指南、参考 |
| 通用助手集成者 | 如何消费 manifest、能力和 fallback | guides/assistants | 集成指南 |
| 第二产品作者 | 如何复用 framework/compiler | guides/framework | 架构指南 |
| 贡献者 | 如何建立环境并验证变更 | CONTRIBUTING 到 operations/maintainers | 维护操作 |
| 发布维护者 | 如何形成可证明的 release | operations/releases | Runbook |
| 安全审阅者 | 数据、权限、依赖和发布边界是什么 | reference/security | 参考与政策 |
| 项目决策者 | 当前决策、迁移和路线是什么 | project | ADR、迁移、计划 |

## 9. 目标信息架构

根目录保留：

    README.md
    README.en.md
    AGENTS.md
    CLAUDE.md
    CHANGELOG.md
    CONTRIBUTING.md
    SECURITY.md
    ROADMAP.md
    CODE_OF_CONDUCT.md
    LICENSE

docs 目标结构：

    docs/
      README.md
      getting-started/
      tutorials/
      guides/
        assistants/
        framework/
        workflows/
      reference/
        architecture/
        compatibility/
        evaluation/
        security/
        workflows/
      operations/
        maintainers/
        marketplace/
        releases/
        community/
      templates/
        consumer-profiles/
        evidence/
        prompts/
      project/
        decisions/
        migrations/
        plans/
        release-notes/
      generated/
      assets/

nova-plugin/docs 目标结构保持插件本地边界：

    nova-plugin/docs/
      README.md
      architecture/
      commands/
        explore/
        plan/
        review/
        implement/
        finalize/
        codex/
      guides/
      overview/

其中 commands 下输入快照中的 63 份文档保留稳定路径，但全部改为生成产物。
architecture 只说明插件内部实现，不再复制公共框架架构；guides 合并成一份
任务手册和一份生成的参考索引；overview/README.en.md 在英文根入口稳定后
按公共 URL 兼容策略保留 stub。

## 10. 根目录文档逐项重写

| 文件 | 目标职责 | 必须删除或下沉的内容 |
| --- | --- | --- |
| README.md | 简洁的中文产品入口：定位、五阶段、5 分钟体验、安装选择、证据边界、文档路由；行数只作预警，不作硬门 | 完整命令清单、完整目录树、维护者门、重复安全政策 |
| README.en.md | 与中文入口同级的英文入口，机器事实由同一生成片段提供 | 不从插件 overview 手工复制旧数字 |
| AGENTS.md | Codex 与通用 agent 的短适配器，只保留库存和差异行为 | CLAUDE 的架构、流程和门的重复叙述 |
| CLAUDE.md | Claude Code 的唯一仓库操作规范和权威事实路由 | 面向普通用户的教程和营销叙述 |
| CHANGELOG.md | 发布级用户可见变化，按版本组织 | 长期计划、未发布猜测、维护过程日志 |
| CONTRIBUTING.md | 一条贡献闭环、变更类型路由、`npm run check`、PR 证据要求 | 重复列出全部脚本 |
| SECURITY.md | 支持范围、报告渠道、响应边界和安全声明 | 实施细节教程与不受保证的绝对表述 |
| ROADMAP.md | 证据支持的近中期方向、非目标和进入条件 | 已完成任务的逐条流水账 |
| CODE_OF_CONDUCT.md | 社区行为政策 | 项目操作说明 |
| LICENSE | 原样保留，除非独立法律审阅批准 | 所有编辑性重写 |

## 11. docs 全量迁移映射

下表覆盖输入快照中 `docs/` 下的全部目录和文件。实施时必须用 migration
manifest 对重新扫描的实时树做差集检查。未特别说明的旧公共路径保留兼容
stub；只有满足 WP10 的独立退出条件才可删除。generated 和二进制资源除外。

### 11.1 入口、决策、路由与资产

| 当前路径 | 目标路径或处置 |
| --- | --- |
| docs/README.md | 原路径重写为按读者和任务导航，目录表由 metadata 生成 |
| docs/start-here.md | 合并到 docs/getting-started/README.md |
| docs/getting-started.md | 拆为 first-workflow.md 与 install-claude-code.md |
| docs/adr/0001-truth-release-capability-evidence.md | docs/project/decisions/0001-truth-release-capability-evidence.md |
| docs/agents/ROUTING.md | docs/reference/architecture/agent-routing.md |
| docs/agents/PLUGIN_AWARE_ROUTING.md | 合并到 agent-routing.md 的 enhanced/fallback 章节 |
| docs/assets/README.md | docs/operations/community/assets.md |
| docs/assets/social-preview-1280x640.png | 保持原路径，作为二进制资产 |

### 11.2 兼容、框架与消费者

| 当前路径 | 目标路径或处置 |
| --- | --- |
| docs/compatibility/README.md | docs/reference/compatibility/README.md |
| docs/compatibility/public-api.md | docs/reference/compatibility/public-api.md |
| docs/compatibility/assistant-levels.md | docs/reference/compatibility/assistant-levels.md |
| docs/compatibility/contract-semver.md | docs/reference/compatibility/contract-semver.md |
| docs/framework/README.md | docs/reference/architecture/framework.md |
| docs/framework/second-product.md | docs/guides/framework/second-product.md |
| docs/consumers/README.md | 拆为 docs/guides/assistants/README.md 与 docs/templates/consumer-profiles/README.md |
| docs/consumers/aider-setup.md | docs/guides/assistants/aider.md |
| docs/consumers/cline-setup.md | docs/guides/assistants/cline.md |
| docs/consumers/codex-setup.md | docs/guides/assistants/codex.md |
| docs/consumers/copilot-setup.md | docs/guides/assistants/copilot.md |
| docs/consumers/cursor-setup.md | docs/guides/assistants/cursor.md |
| docs/consumers/gemini-cli-setup.md | docs/guides/assistants/gemini-cli.md |
| docs/consumers/opencode-setup.md | docs/guides/assistants/opencode.md |
| docs/consumers/openhands-setup.md | docs/guides/assistants/openhands.md |
| docs/consumers/profile-contract.md | docs/templates/consumer-profiles/contract.md |
| docs/consumers/private-java-backend-template.md | docs/templates/consumer-profiles/java-backend.md |
| docs/consumers/frontend-project-template.md | docs/templates/consumer-profiles/frontend.md |
| docs/consumers/workbench-template.md | docs/templates/consumer-profiles/workbench.md |
| docs/consumers/shell-policy-template.json | docs/templates/consumer-profiles/shell-policy.json |

### 11.3 示例、教程与评测

| 当前路径 | 目标路径或处置 |
| --- | --- |
| docs/examples/README.md | 合并到 docs/tutorials/README.md |
| docs/examples/java-backend/redacted-feature.md | docs/tutorials/java-backend.md 的 fixture |
| docs/examples/frontend/basic-feature.md | docs/tutorials/frontend.md 的 fixture |
| docs/examples/primary-workflow-transcript.md | docs/tutorials/first-workflow-transcript.md |
| docs/examples/workflow-evaluation.md | docs/tutorials/workflow-evaluation.md |
| docs/examples/workflow-evaluation-record-template.md | docs/templates/evidence/workflow-evaluation.md |
| docs/showcase/README.md | 合并到 docs/tutorials/README.md |
| docs/showcase/java-backend.md | 合并并重写为 docs/tutorials/java-backend.md |
| docs/showcase/frontend.md | 合并并重写为 docs/tutorials/frontend.md |
| docs/showcase/release-and-docs.md | docs/tutorials/release-and-docs.md |
| docs/quality/benchmark.md | docs/reference/evaluation/benchmark.md，并改为生成文档 |

### 11.4 维护、发布与市场

| 当前路径 | 目标路径或处置 |
| --- | --- |
| docs/llm-plugins-fusion-maintenance-status.md | docs/operations/maintainers/status.md，状态字段生成 |
| docs/maintainers/quickstart.md | docs/operations/maintainers/README.md |
| docs/maintainers/validation-index.md | docs/operations/maintainers/validation.md |
| docs/maintainers/task-catalog.md | 合并到 validation.md，任务表生成 |
| docs/maintainers/troubleshooting.md | docs/operations/maintainers/troubleshooting.md |
| docs/maintainers/github-security-settings.md | docs/operations/maintainers/github-security.md |
| docs/maintainers/release-runbook.md | 合并到 docs/operations/releases/runbook.md |
| docs/maintainers/post-remediation-audit.md | 当前行动合并到 docs/project/plans/current-remediation.md；完成证据进入 release note、ADR 或 evidence manifest，并由 Git 历史追溯 |
| docs/maintainers/comprehensive-audit-remediation-plan.md | 同上，去除重复执行流水 |
| docs/maintainers/deep-research-remediation-and-documentation-redesign-plan.md | 实施期迁移到 docs/project/plans/current-remediation.md，完成后只保留仍有效决策 |
| docs/project-optimization-plan.md | 未完成项并入 current-remediation.md；完成项由 release note、ADR 或 evidence manifest 摘要并从 Git 历史追溯 |
| docs/growth/README.md | docs/operations/community/metrics.md |
| docs/marketplace/catalog.md | 保持原路径和生成属性，这是当前公共生成契约 |
| docs/marketplace/registry-author-workflow.md | docs/operations/marketplace/registry-authoring.md |
| docs/marketplace/compatibility-matrix.md | docs/reference/compatibility/marketplace.md，并由事实源生成 |
| docs/marketplace/trust-policy.md | docs/reference/security/marketplace-trust.md |
| docs/marketplace/security-review-route.md | docs/reference/security/security-review.md |
| docs/marketplace/v3-readiness-evidence.md | 有效决策并入 current-remediation.md，历史证据由 3.0.0 release note 承担 |
| docs/marketplace/multi-plugin-readiness.md | docs/project/plans/multi-plugin-readiness.md，保持非承诺状态 |
| docs/marketplace/portal-information-architecture.md | docs/project/plans/portal-information-architecture.md，保持非承诺状态 |

### 11.5 发布、迁移、隐私与工作流

| 当前路径 | 目标路径或处置 |
| --- | --- |
| docs/releases/3.0.0-notes.md | docs/project/release-notes/3.0.0.md，并与 CHANGELOG/GitHub Release 去重 |
| docs/releases/3.0.1-notes.md | docs/project/release-notes/3.0.1.md，并与 CHANGELOG/GitHub Release 去重 |
| docs/releases/3.0.0-audit-closure.md | 合并到 3.0.0 release note 的 evidence 章节 |
| docs/releases/release-validation-runbook.md | docs/operations/releases/validation.md |
| docs/releases/release-hygiene.md | docs/operations/releases/hygiene.md |
| docs/releases/operator-recovery-and-key-rotation.md | docs/operations/releases/recovery-and-key-rotation.md |
| docs/releases/release-evidence-template.md | docs/templates/evidence/release.md |
| docs/migrations/2.4.1-command-namespace.md | docs/project/migrations/2.4.1-command-namespace.md |
| docs/migrations/3.0.0-adapters-and-direct-commands.md | docs/project/migrations/3.0.0-adapters-and-direct-commands.md |
| docs/migrations/contract-v6.md | docs/project/migrations/contract-v6.md |
| docs/privacy/data-handling.md | docs/reference/security/data-handling.md |
| docs/workflows/context-safe-agent-workflows.md | docs/guides/workflows/context-safe.md |
| docs/workflows/source-controlled-checks.md | docs/guides/workflows/source-controlled-checks.md |
| docs/workflows/gsd-informed-hardening.md | docs/guides/workflows/hardening.md，去除外部产品式定位 |
| docs/workflows/routing-validation-guardrails.md | docs/reference/workflows/routing-guardrails.md |
| docs/workflows/thin-harness-fat-skills.md | docs/reference/architecture/skill-first-projection.md |
| docs/workflows/verification-evidence-contract.md | docs/reference/workflows/verification-evidence.md |

### 11.6 Prompt 模板

| 当前路径 | 目标路径或处置 |
| --- | --- |
| docs/prompts/README.md | docs/templates/prompts/README.md |
| docs/prompts/claude-code/fix-from-review.md | docs/templates/prompts/claude-code/fix-from-review.md |
| docs/prompts/claude-code/serial-checkpoint.md | docs/templates/prompts/claude-code/serial-checkpoint.md |
| docs/prompts/claude-code/subagent-execution.md | docs/templates/prompts/claude-code/subagent-execution.md |
| docs/prompts/codex/context-safe-review.md | docs/templates/prompts/codex/context-safe-review.md |
| docs/prompts/codex/final-verification.md | docs/templates/prompts/codex/final-verification.md |
| docs/prompts/common/checkpoint-artifact.md | docs/templates/prompts/common/checkpoint-artifact.md |
| docs/prompts/common/delivery-docs.md | docs/templates/prompts/common/delivery-docs.md |
| docs/prompts/common/html-artifact.md | docs/templates/prompts/common/html-artifact.md |
| docs/prompts/common/skill-harness-audit.md | docs/templates/prompts/common/skill-harness-audit.md |
| docs/prompts/common/workbench-tidy.md | docs/templates/prompts/common/workbench-tidy.md |

### 11.7 Generated 与 JSON

以下文件保持原路径和生成属性，只更新生成器、源数据和导航：

- docs/generated/assistant-compatibility.md
- docs/generated/effective-permissions.json
- docs/generated/effective-permissions.md
- docs/generated/prompt-surface-report.json
- docs/generated/prompt-surface-report.md
- docs/generated/real-task-benchmark.json
- docs/generated/real-task-benchmark.md
- docs/generated/surface-inventory.json
- docs/generated/surface-inventory.md
- docs/generated/workflow-catalog.json
- docs/generated/workflow-catalog.md

任何 generated 文件都不得手工迁移或编辑。若公共 API 决定更改路径，必须
先修改生成器和 registry/source contract，再由生成器写出。

## 12. 其他文档面的重新组织

### nova-plugin/docs

- 保留 commands 的阶段目录和 codex 目录；输入快照中的 63 份文档改为生成。
- 现有大型 handbook/reference 合并为一份任务手册和一份生成参考索引。
- 中文与英文手册共享生成表、示例元数据和链接，不手工复制命令矩阵。
- 现有 architecture 文档只保留插件内部 agent stack、dual-track 和 hooks 设计，
  公共框架内容链接到 docs/reference/architecture。
- overview/README.en.md 的有效内容迁入根 README.en.md，原页短期跳转。
- nova-plugin/docs/README.md 缩为插件文档路由，不再列出所有文件。

### 运行时与就近文档

| 位置 | 重写目标 |
| --- | --- |
| adapters/README.md | 适配器选择和共享契约入口 |
| adapters/claude/README.md | 仅 Claude adapter 构建、安装和验证 |
| adapters/codex/README.md 与 AGENTS.md | Codex 能力、边界和生成规则 |
| adapters/generic-agent-skills/README.md | assistant manifest 与 capability negotiation |
| evals/README.md | 数据集 schema、profiles、计划与实跑证据边界 |
| framework/README.md | 包 API、编译链和最小第二产品示例 |
| workflow-specs/README.md | Workflow IR 作者契约与生成命令 |
| fixture README | 只解释 fixture 目的、输入和断言，不复制产品文档 |
| skills/agents/packs | 保持运行时合同位置；人类导航由生成目录提供 |

## 13. 文档重写规范

每份人工文档必须能从统一 front matter 或 schema-governed sidecar registry
解析出 metadata。不要为了统一格式给 `AGENTS.md`、`CLAUDE.md`、README、
GitHub community-health 文件或其他工具发现入口强行注入可能改变消费语义的
front matter；这些文件优先使用 sidecar。生成文档的 metadata 由生成器负责，
不得手工维护。

人工文档 metadata 至少包括：

- title
- audience
- contentType
- status
- ownerSource
- sourceOfTruth
- lastVerified
- appliesTo
- generated
- redirectsFrom

`lastVerified` 必须指向可解释的验证日期或 evidence ref，不能在没有重新验证
内容时机械刷新。`ownerSource` 和 `sourceOfTruth` 使用 schema 允许的文件路径、
registry id 或责任角色，不填写无法验证的自由文本。

每类文档采用固定结构：

- 教程：目标、前置条件、fixture、逐步操作、预期结果、验证、清理、下一步。
- 指南：何时使用、决策条件、步骤、替代方案、常见失败、相关参考。
- 参考：契约、字段、默认值、退出码、兼容性、稳定性和示例。
- Runbook：权限、前置门、操作、观察点、回滚、证据、升级路径。
- ADR：背景、决策、替代方案、后果、状态。
- 计划：目标、非目标、工作包、依赖、验收、外部门；不保留已完成流水账。

写作规则：

1. 先写用户任务，再写内部架构。
2. 当前机器事实只引用生成片段；历史快照可以写静态数字，但必须明确日期、
   ref、范围与来源。
3. 命令必须可复制；破坏性或用户级写入必须紧邻命令标注。
4. human-readable 状态通过 diagnostics/evidence registry 映射到 Verified、
   Not verified、Skipped、Blocked 和 Planned；不与现有机器状态码混用或
   擅自改变大小写。
5. 公共示例必须脱敏且可在 fixture 中复现。
6. 普通任务页末尾只保留 2 至 5 个强相关链接，避免全站目录复制；导航、
   索引和 reference hub 不受该数量限制，但链接必须由 metadata 生成或校验。
7. 标题和锚点稳定；重命名必须登记 redirectsFrom。

## 14. 文档迁移实施批次

### 批次 A：治理基础

- 引入 doc metadata schema、source-of-truth registry、redirect map。
- 提取 validate-docs 硬编码路径和事实到 registry。
- 增加链接、锚点、孤儿页、重复事实和 generated-drift 检查。
- 先生成新导航，不移动文件。

### 批次 B：入口与事实

- 重写根 README、README.en、docs/README、CONTRIBUTING。
- 消费 WP1 已修复的评测事实并重写质量导航；不得把事实修复推迟到本批次或
  再维护一套计数。
- 建立 getting-started 与 operations/maintainers。
- 保持旧入口为兼容 stub。

### 批次 C：教程、指南与模板

- 合并 examples 与 showcase。
- 迁移 consumers、workflows 和 prompts。
- 建立 CI 可运行教程。

### 批次 D：参考、项目与发布

- 迁移 compatibility、framework、agents、privacy、marketplace、releases、
  migrations 和 ADR。
- 把三个既有整改/优化记录与本文仍可执行的事项归并到 active plan；已完成
  结论只进入对应 release note、ADR 或 evidence manifest，不复制流水账。
- 保持 marketplace/catalog 与 generated 的稳定生成路径。

### 批次 E：插件与就近文档

- 生成输入快照中的 63 份命令文档和导航；实际数量从实时 workflow inventory
  推导。
- 合并大型 handbook/reference。
- 重写 adapters、evals、framework 和 workflow-specs README。

### 批次 F：迁移收口与 URL 退出审查

- 用 redirect map 和全仓库搜索确认旧链接已迁移。
- 只删除已通过 WP10 独立 URL 退出审查的迁移页；其余兼容 stub 继续保留。
- 重新生成 surface inventory、marketplace 和发布摘要。
- 在 clean checkout 完成全门验证。

每批必须独立通过默认门；若某一批无法独立回滚，应继续拆分。

## 15. 文档质量门与量化验收

必须新增或强化以下检查：

| 检查 | 失败条件 |
| --- | --- |
| Metadata | 人工文档缺少必填字段或 ownerSource 无效 |
| Source of truth | 同一机器事实由多个手工源维护 |
| Links and anchors | 内部链接、锚点或 redirect target 不存在 |
| Orphans | 非 generated、非 policy、非已登记就近文档的页面没有任何入口；豁免必须在 metadata registry 中有理由和 owner |
| Generated drift | 生成器运行后产生未提交差异 |
| Inventory | 树扫描发现未分类文档或漏迁移文件 |
| Historical claims | 历史数字缺日期、版本或证据来源 |
| Safety wording | 跳过项写成通过，best-effort 写成保证 |
| Public hygiene | 本机路径、私有名称、凭据或私有端点进入分发内容 |
| Tutorial smoke | 教程命令、fixture 或预期断言失效 |
| Translation facts | 中英文机器事实不一致 |

量化目标：

- docs 下 100% 文件在 migration manifest 中有 target 和 disposition。
- 100% 人工文档能通过 front matter 或 sidecar registry 解析出 audience、
  contentType、status 和 sourceOfTruth。
- 100% 生成文档能追溯到生成器和源文件。
- 0 个断链、0 个未解释孤儿页、0 个未登记旧路径；保留中的兼容 stub 不是
  孤儿页。
- 版本、库存、评测规模、兼容级别和脚本目录表的手工事实源均为 0。
- 根 README 控制为入口而非手册；docs/README 不再手列全量文件。
- 对当前旧事实的非历史残留搜索为 0。

行数只作为预警，不作为删除有用信息的目标。大型参考应通过生成、分章和
任务导航解决，而不是机械压缩。

## 16. 提交与评审策略

推荐提交序列：

1. baseline and fix live-eval dataset-identity fact drift
2. add diagnostics schema and reason registry
3. add doc metadata and generator foundations
4. reorganize entry and maintainer docs
5. reorganize tutorials, guides, templates
6. reorganize reference, project, release docs
7. generate plugin command docs and navigation
8. add dependency evidence automation
9. add layered live-eval evidence automation
10. add security and audit/concurrency regressions
11. add comparable performance baselines and budgets
12. retire eligible migration stubs and produce release evidence

每个提交的评审记录应包含：

- 变更单元和权威源。
- 已验证事实与命令。
- 生成文件列表。
- 跳过或外部阻塞的检查。
- 残余风险和回滚方式。

禁止把全部文档移动、全部生成器修改和行为改动压成一个不可审阅提交。

## 17. 完成定义

本方案只有在以下条件同时满足时才算完成：

1. 第 4 节每个报告方向都有已合并实现、明确拒绝理由或独立外部证据门。
2. live 数据集被误写为 24-case 的漂移由测试永久阻止，同时 24-task
   real-task benchmark 与明确标期的历史快照继续保持正确。
3. assistant manifest 是唯一通用助手执行清单。
4. doctor、bootstrap、validation 和 install smoke 使用共同诊断契约。
5. 第 11 节列出的 docs 全部完成迁移或被明确保留。
6. 根目录、docs、nova-plugin/docs 和就近 README 全部按第 13 节重写。
7. 命令文档和导航从 schema-governed 文档 metadata 与现有 workflow/runtime
   权威源生成。
8. 依赖审计、分层评测、安全竞态和性能基线有持续证据。
9. 默认校验在 clean checkout 通过，Bash 相关门实际运行，所有 skip 被披露。
10. 旧公共 URL 已保留兼容 stub，或已通过独立 URL 退出审查并在发布说明中
    披露；redirect map 没有被当作真实 redirect。
11. 外部安装、发布、签名和真实助手证据没有被本地 dry-run 替代。

## 18. 风险与止损

| 风险 | 止损措施 |
| --- | --- |
| 目录重构破坏公共链接 | redirect map、可验证兼容 stub、独立 URL 退出审查、分批迁移 |
| 生成器扩大后隐藏错误 | schema、golden tests、determinism、人工抽样 |
| 文档精简丢失有效知识 | 迁移 manifest 逐文件 disposition，删除前搜索引用 |
| 中英文再次漂移 | 机器事实共享生成，叙事内容分开评审 |
| live eval 成本失控 | profile 分层、预算上限、release/manual 外部门 |
| 安全扫描网络不稳定 | 区分 clean 与 blocked，保留最近成功证据和有效期 |
| 落后主线导致重复实现 | WP0 强制基于最新主线并先运行生成漂移检查 |
| 一次性巨型 PR 无法评审 | 按第 16 节拆分提交和 PR，逐单元验收 |

该方案优先减少事实源和维护面，而不是增加新的产品表面。只有在现有单插件
工作流框架的安装、诊断、文档和证据闭环稳定后，才重新评估门户或多插件
扩展。

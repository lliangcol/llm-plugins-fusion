<!-- migrated-from: docs/maintainers/deep-research-remediation-and-documentation-redesign-plan.md -->
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
| WP1 | implemented | `live-paired` 从 168 cases 推导 1,008 次；`real-task-benchmark` 从 24 tasks 推导 432 次；历史 24-case 快照保留日期和证据语义 | evaluation facts、project-state、fact graph、质量报告及同步块；提交 `d57a7d6` | targeted tests、schema、docs、生成器二次写入与 drift check 通过；真实助手结果仍属外部门 |
| WP2 | implemented | doctor、llmf doctor、bootstrap、validate-all 输出产物与 install dry-run 使用共享 diagnostics contract 和 reason registry | diagnostics schemas/registry、生成矩阵、`validate:bootstrap`、`demo:all`、JSON 输出；提交 `c037327` | schema 与 e2e 检查通过；子进程未识别的 Claude/Codex 为 Skipped 而非 Passed；回滚为还原本验收单元 |
| WP3 | implemented | assistant manifest 与 v6/v2 生成链继续复用；sidecar metadata、workflow-id 文档 metadata、63 个命令文档生成块和导航已接入默认门 | doc/workflow metadata schemas、command-doc 与 doc-governance generators、generated navigation/manifest/redirect map；提交 `e63cce1` | 二次写入后 drift checks 及完整门通过；未改变六技能、21 命令或 runtime contract；回滚为还原本验收单元 |
| WP4 | implemented | 实时树重新生成 migration manifest；84 个旧公共路径保留 83 个 Markdown stub 和 1 个可解析、与新路径一致的 JSON 兼容副本；二进制与 generated 契约不移动 | `governance/docs-migrations.json`、迁移器、目标 IA、redirect map、导航、生成器与校验器路径对账 | 文档、schema、pack、workflow 与 regression targeted gates 通过；本轮禁止兼容路径删除，回滚为还原本迁移单元 |
| WP5 | implemented | 现有 Dependency Review 保持 PR 增量门；本地 `npm audit --json` 对当前 lockfile 返回 0 vulnerabilities | dependency audit schema/evidence/summary、例外基线、定期/手动 workflow、默认门；提交 `cb14c24` | 本地网络审计 Passed；workflow 仅静态验证且未触发，远端运行仍为 External evidence；分发插件无 Node runtime dependency |
| WP6 | implemented | critical/PR/nightly/release/manual profiles 通过 dataset identity 与 category 查询复用 168-case/8-case 数据，不复制 case；24-task 仍推导 432 次 | evaluation profile schema/source 与 generated JSON/Markdown；提交 `c6ab255` | 本地仅生成 plan/simulation 边界；executed/passed=0，外部 profile 全部标记 blocked/external-evidence；凭据型 live eval 未授权 |
| WP7 | implemented | 复用 shell digest/session pinning、secret scanner、audit spool/lock 与 validate-all 并发；补半写恢复、陈旧锁和双进程 at-most-once 测试，并修复 lock 消失竞态 | performance budget schema/source/validator、audit compactor tests；提交 `c6ab255` 后由最终集成提交补齐回归 | 同一 Windows/Node24 报告求和任务 wall time 28,941ms，预算 60,000ms；CPU time unavailable；平台 symlink skip 仍单独报告 |
| WP8 | implemented | 四条现有教程迁入目标 IA，新增 minimal consumer 只读 walkthrough；不改受保护 fixture | tutorial smoke、good-first-task issue form、generated navigation；提交 `c6ab255` | route/review/conformance 非凭据路径实际执行；未执行 slash-command 或用户范围安装 |
| WP9 | implemented | stable channel、install proof、adoption ledger 和 digest 生成固定五分区发布摘要 | generated release summary JSON/Markdown；提交 `c6ab255` | 当前 checkout exact tag、签名、用户范围安装、远端 CI、live eval 均明确 Not verified/Skipped/External evidence |
| WP10 | implemented | 本地迁移、兼容、生成与回归已收口；84 个公共兼容路径全部保留，其中 JSON 模板继续保持机器可读 | redirect map、覆盖率回归和最终集成修复 | `npm run check` Passed；最终 HEAD 的 clean-checkout 门作为提交后证明记录于交付，不删除兼容路径、不改版本/渠道、不触发远端 |

| 报告方向 | 状态 | 工作包与实时决策 |
| --- | --- | --- |
| 统一新手入口与一键演示 | partial | WP2/WP8；安全的 `demo:all` 已实现，教程导航待 WP8 |
| 贡献者检查聚合 | implemented | WP2；保留现有唯一 `npm run check`，仅核对覆盖面 |
| bootstrap 校验 | implemented | WP2；只读入口复用 reason registry，未执行 `npm ci` |
| 机器可读诊断 | implemented | WP2；统一 schema、状态、reason code、文本与 JSON 输出 |
| Commands、Skills、Docs、Runtime 生成 | partial | WP3；运行时链已实现，命令文档和导航待接入 |
| 紧凑执行清单 | implemented | WP3；复用现有 assistant manifest，拒绝第二套清单 |
| 依赖与供应链自动证据 | partial | WP5；PR 门已存在，定期审计摘要待实现 |
| 扩大 live eval | partial | WP1/WP6；数据集已扩大且事实漂移已修，真实运行仍为外部门 |
| Windows/Bash 诊断 | implemented | WP2；平台结果、skip 原因、JSON 与 remediation 已统一 |
| 中文失败矩阵 | implemented | WP2；故障矩阵从 reason registry 生成，不手工维护第二份 |
| 教程与 showcase | partial | WP8；fixtures 已存在，教程与 CI smoke 待整合 |
| 发布摘要模板 | partial | WP9；现有证据模板待生成式整合 |
| shell policy 锁定 | partial | WP7；现有摘要和会话固定，竞态回归待补 |
| 校验性能 | partial | WP7；并发和 timings 已存在，可比较预算待补 |
| 审计与并发 | partial | WP7；spool/compaction/lock 已存在，压力与恢复证据待补 |
| 竞品定位 | partial | WP9；当前定位正确，双语入口和 ROADMAP 待收敛 |
| 多插件生态与门户 | rejected | 证据不足，保持 deferred；不在本轮实现 |

| 文档批次 | 状态 | 当前边界 |
| --- | --- | --- |
| A 治理基础 | implemented | sidecar metadata 同时解析 owner/source-of-truth，migration manifest、redirect map、导航和默认门已实现 |
| B 入口与事实 | implemented | 新入口、事实同步目标、维护者状态和评测参考已迁移并由现有事实链生成 |
| C 教程、指南与模板 | implemented | 教程、assistant 指南、workflow 指南、consumer/evidence/prompt 模板迁入目标 IA；复用既有 fixtures |
| D 参考、项目与发布 | implemented | architecture、compatibility、security、operations、project migrations/plans/release notes 已迁移；活动方案只有本文件 |
| E 插件与就近文档 | implemented | 63 个命令文档已生成化，插件 README 接入索引；教程复用现有 plugin/fixture 本地文档，不复制架构或消费者事实 |
| F 迁移收口 | implemented | redirect map 和 84 个兼容路径均可校验；Markdown 使用 stub，JSON 模板保留有效副本；URL 删除保持未授权 |

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

<!-- merged-from: docs/maintainers/post-remediation-audit.md -->
<details>
<summary>Migrated source: docs/maintainers/post-remediation-audit.md</summary>

# Post-Remediation Audit And Execution Plan

Status: implementation complete; local gates passed; external operational evidence remains required before release

Date: 2026-07-12

This document records the execution plan used to remediate the July 2026 deep
audit and then audits the resulting implementation. It is a current maintainer
record, not release evidence. No tag or release is authorized by this record.

## Execution Plan And Completion Criteria

| Phase | Risk addressed | Delivered change | Completion evidence | Status |
| --- | --- | --- | --- | --- |
| 0. Evidence baseline | Stale or overstated conclusions | Canonical rules, full tree, source state, generated outputs, and existing gates were inspected before edits | Repository validators record source digests and cleanly distinguish static, simulated, smoke, and live claims | Complete |
| 1. Behavior parity | Direct commands silently lose workflow semantics | One structured behavior IR for all 21 workflows now generates compact Skill indexes and behavior-complete runtime contracts | 21/21 surface parity; 29/29 golden cases; safety false negatives 0 | Complete |
| 2. Framework extraction | Generic kernel remains Nova/Claude-specific | Framework, product, behavior, and adapter specifications are separate; compiler consumes explicit layers | A non-Nova, non-Claude fixture compiles 3 workflows with different stages and a mock adapter | Complete |
| 3. Live evaluation v2 | Bare prompt compliance is mistaken for adapter integration | Dataset expanded to 24 hidden-label cases with three attempts; runner records adapter-load proof, digests, tool policy, derived writes, tool calls, invented surfaces, and safe process-failure categories | Dataset and runner unit gates pass; a broad clean-commit run exposed and drove fixes to evaluator input semantics and route output strictness | Complete in code; a fresh full Claude run remains external-rate-limit blocked and no compatibility upgrade is permitted |
| 4. Shell command boundary | Bash bypasses Write/Edit guards | Default-deny command broker parses argv, rejects composition/redirection/expansion, and allows only bounded base or consumer policy commands | Runtime smoke and shell-policy unit suites pass | Complete |
| 5. Schema correctness | A validator subset accepts invalid schema instances | Locked Ajv development dependencies validate draft-07 and draft 2020-12 sources; historical fail-open cases are differential tests | All schemas compile and 4/4 historical fail-open cases are rejected | Complete |
| 6. Release resilience | Candidate assets and evidence can be replaced or promoted without enough independent proof | Candidate evidence is bundled and digest-bound; promotion verifies evidence, source, signed tag, candidate attestations, deterministic rebuild, and independent review | Release candidate/promotion unit and integration suites pass | Complete in code; external GitHub proof required |
| 7. Operator resilience | Single-owner operations and unrehearsed recovery | Source-controlled label sync, independent review policy, signer inventory checks, recovery workflow, recovery/key-rotation runbook, and adoption ledger | Governance validator passes and reports the unclosed operational facts | Complete in code; second signer, rotation, and recovery drill not demonstrated |
| 8. Verification and delivery | Partial validation is reported as completion | Full validation, test coverage, mutation, dependency audit, install dry-run, distribution scan, deterministic build, diff review, and this post-remediation audit | Every command listed under Final Verification must pass before push | In progress until the final commit is pushed |

The stop condition is deliberately stricter than “files changed”: implementation
must pass the full local gate, the final diff must be reviewed, and all generated
surfaces must be current. Operational actions that require GitHub identities,
signing keys, protected environments, tags, or releases remain explicit external
gates and cannot be synthesized by local tests.

## Audit Result

The remediation materially closes the original control-plane versus behavior-
evidence gap. The repository now has a structured, testable behavior source;
adapter-loaded evaluation capability; an assistant-neutral compiler fixture; a
default-deny shell broker; standards-based schema validation; and a release
promotion chain that fails closed when required evidence is absent.

The local engineering posture is strong, but release readiness is intentionally
**not demonstrated**. Current governance truth still records one signer, no
successful recovery drill, no key-rotation evidence, and no external adoption
evidence. These are operational facts rather than missing code.

## Architecture

Risk after remediation: **Low** for specification drift; **Medium** for future
extension pressure.

- `workflow-specs/framework.json` owns assistant-neutral capabilities, risks,
  permission semantics, and behavior concepts.
- `workflow-specs/nova.product.json` owns Nova inventory and product stages.
- `workflow-specs/adapters/*.json` owns assistant installation, invocation, and
  enforcement details.
- `workflow-specs/behaviors.json` owns input resolution, decisions, invariants,
  stops, steps, deviation policy, output shape, and failure behavior.
- The minimal-product fixture proves the compiler is not dependent on `nova-`,
  Claude, Codex, the five Nova stages, or the 21-workflow count.

Residual risk: only one alternative product fixture exists. Add another fixture
only when a real product variant requires new capability semantics; do not grow
the public plugin surface merely to prove abstraction.

## Core Workflow And Behavior

Risk after remediation: **Low** for deterministic contract drift; **Medium** for
stochastic assistant quality until a complete clean-commit live run is retained.

- All 21 direct commands receive behavior-complete runtime contracts generated
  from one IR.
- Skill surfaces include generated behavior indexes and drift checks.
- Twenty-nine golden cases cover aliases, defaults, exact approval values,
  blocking conditions, route selection, outputs, and failure behavior with zero
  safety false negatives.
- The 2026-07-12 clean-commit evaluation snapshot used 24 public-safe cases
  with expected answers excluded from prompts and three attempts per case.
  This is historical evidence, not the current live dataset inventory.
- The runner derives writes, tool calls, inventory use, and invented surfaces
  from execution state instead of trusting model self-report.
- Claude loads the plugin directory; Codex receives a digest-bound adapter proof
  in its isolated sandbox.

Residual risk: diagnostic route probes do not substitute for the current full
dataset plan. No compatibility level may be upgraded from runner capability or
from a dirty working tree.

### Clean-Commit Evaluation Observation

An untracked local evaluation against clean commit `127d22e` ran all 24 cases
three times for each known-good assistant. Both initial batches passed 50/72.
Neither produced project writes, unexpected tool use, invented surfaces, or an
adapter-boundary bypass.

The result was not accepted as a compatibility upgrade:

- Codex failures exposed an evaluator contradiction: route cases were expected
  to list all downstream canonical inputs while the prompt requested unresolved
  inputs only, and direct approval cases were not locked to their target
  workflow. The prompt contract was corrected; representative route and direct
  approval diagnostics then passed 6/6.
- Claude produced twelve otherwise-correct route responses with forbidden
  preamble text before the fixed heading. The behavior IR and live invocation
  now require the heading as the first bytes with no surrounding commentary.
- Later Claude calls exited through the external CLI. The revised runner safely
  classified representative retries as `rate-limit` without retaining raw
  diagnostics. A complete rerun must wait for external capacity and remains a
  pre-release operational gate.

These observations remain local evaluation evidence. They are not checked-in
release evidence and do not raise the generated L2 compatibility declarations.

## Code Quality

Risk after remediation: **Low**.

- The workflow compiler, input resolver, schema engine, label catalog, and
  independent-review evaluator have explicit module boundaries and unit tests.
- Ajv is a development-only dependency; it does not enter the distributed
  `nova-plugin` runtime archive.
- File URL handling is centralized and a repository rule rejects non-portable
  `.pathname` conversions.
- The v3 validator path remains a compatibility entrypoint that delegates to the
  canonical v4 validator.
- Coverage source inventory fails if any maintenance module is not loaded.

Residual risk: a few broad maintenance scripts remain below preferred per-file
coverage even though global and critical-module floors pass. Raise targeted
coverage when those scripts change rather than optimizing percentages without a
risk-bearing assertion.

## Documentation And Developer Experience

Risk after remediation: **Low**.

- Architecture guidance now describes behavior-complete runtime contracts rather
  than treating a compact metadata file as the full behavior source.
- The primary-workflow transcript shows route plus Explore, Plan, Review,
  Implement, and Finalize with exact canonical inputs and before/after evidence.
- Public quality reporting separates deterministic tests, legacy bare-CLI
  observations, adapter-loaded capability, and release proof.
- Main documentation continues to emphasize six primary entrypoints; advanced
  compatibility commands remain secondary.
- Consumer guidance includes a scoped shell-policy template.

Residual risk: public examples prove contract shape, not independent product
adoption or production outcome improvement.

## Tests And CI

Risk after remediation: **Low locally**; **Medium until the branch CI run is
observed**.

- The full Node test suite covers unit, integration, and E2E layers; current
  run totals belong in observed validation output rather than this durable audit.
- Coverage gates require at least 85% lines, 70% branches, and 90% functions,
  plus critical-module floors and complete maintenance-module loading.
- The targeted mutation gate remains accurately scoped to three selected
  high-risk operators; it is not described as repository-wide mutation testing.
- GitHub workflows install locked development dependencies with
  `npm ci --ignore-scripts`.
- Windows-compatible validators include the generated and model-validation
  surfaces; Bash-only checks retain explicit platform semantics.
- Package CI builds twice and compares bytes.

Residual risk: local success cannot prove the pushed branch's GitHub Actions,
rulesets, protected environments, or dependency-review service state.

## Security

Risk after remediation: **Medium-Low**.

- The shell broker is default-deny and rejects shell composition, pipes,
  redirects, expansions, parent traversal, unsafe external working-directory
  options, and symlinked policy files.
- Write/Edit path containment, hard-link protection, secret detection, post-write
  verification, and audit-log stale-lock recovery remain covered.
- Standard schema validation fails closed on unknown formats and schema compile
  errors.
- Distribution and secret scanning include tracked, untracked, generated-looking,
  large-text, binary, and historical boundaries.

Residual risk: a user can still explicitly authorize a general external shell
outside the plugin broker in the host assistant. The plugin is a guardrail, not
an operating-system sandbox. Consumer policy should remain narrow and reviewed.

## Release And Supply Chain

Risk after remediation: **Low in local verification logic**; **High if operators
bypass the documented GitHub process**.

- Candidate bundles contain required evidence rather than merely referring to
  local files.
- Manifest records use collision-safe paths, sizes, hashes, schemas, and
  promotion-required flags.
- Stable promotion verifies candidate tag identity and signature, original
  candidate attestations with expected repository/workflow identity, all required
  evidence, and a deterministic rebuild while preserving the original RC bytes.
- Candidate generation requires a current independent approval bound to the
  pull request's final head commit by a reviewer who is neither PR author nor
  candidate actor.
- Recovery verification downloads, verifies, safely extracts, re-attests, and
  runs promotion verification without publishing a release.
- Label automation creates or updates catalog labels and never deletes labels.

Residual risk: the repository currently demonstrates only one signer and has no
recorded successful recovery drill or signing-key rotation. No tag or release
should be created until those release-specific operational gates and branch CI
are independently verified.

## Risk And ROI Roadmap

| Phase | Severity | Investment | Expected return | Executable actions | Exit condition |
| --- | --- | ---: | --- | --- | --- |
| A. Before any release | High | Medium | Prevents unsupported compatibility and supply-chain claims | Retain the full current dataset plan for each known-good assistant from a clean commit; obtain independent review; observe branch CI; add a second authorized signer; perform and record recovery plus key-rotation drills | All required evidence is digest-bound, current, independently reviewed, and externally verified |
| B. Adoption proof | Medium | Medium | Converts engineering control strength into product evidence | Run exact-commit public fixture transcripts with consenting external users; record completion, missing-input recall, approval blocking, unrelated writes, and validation honesty; keep raw private data out of the repository | Adoption ledger changes from `not-demonstrated` only when reproducible evidence exists |
| C. Targeted robustness | Medium | Low to Medium | Improves high-risk confidence without growing surface area | Add mutations for approval downgrade, evidence omission, route missing fields, Windows paths, and process timeouts; add fuzz/property tests around parsers and manifest resolution | Each newly identified high-risk failure mode has a killing assertion |
| D. Conditional product expansion | Low | High | Avoids premature ecosystem cost | Keep commands, packs, multi-plugin layout, hosted portal, and dynamic loading frozen until repeated external demand and ownership capacity are demonstrated | A reviewed product decision includes adoption evidence, maintenance owner, threat model, and rollback plan |

Priority is based on residual risk and return, not novelty. Phase A blocks a
release; phases B and C can proceed without publishing; phase D remains deferred.

## Final Verification

The following evidence must be refreshed on the final implementation state:

```bash
npm test
npm run test:coverage:check
npm run test:mutation:critical
npm audit --audit-level=high
node scripts/validate-plugin-install.mjs --dry-run
node scripts/scan-distribution-risk.mjs
node scripts/validate-all.mjs --write-timings
git diff --check
```

Deterministic release artifacts must also be built twice and compared. A full
adapter-loaded live run should be retained only from a clean commit; it is
evaluation evidence, not authorization to tag or release.

</details>

<!-- merged-from: docs/maintainers/comprehensive-audit-remediation-plan.md -->
<details>
<summary>Migrated source: docs/maintainers/comprehensive-audit-remediation-plan.md</summary>

# Comprehensive Audit Remediation Plan

Status: local implementation executed; release and live/adoption evidence remain blocked

Date: 2026-07-13

This plan translates the current repository audit into a complete, ordered
remediation program. It covers product positioning, architecture,
implementation, APIs, data models, tests, performance, CI/CD, security,
dependencies, compliance, release operations, and continuing governance.

The plan is deliberately evidence-bound. A green local validation run proves
local engineering readiness only. It does not prove independent review,
protected-environment approval, a recovery drill, live assistant quality,
external adoption, tag publication, or stable installation.

## Baseline And Decision

The repository is locally healthy but the current development head is not
eligible for a new stable publication.

- `nova-plugin` remains the only production plugin and the only current
  marketplace installation unit.
- `v4.0.0` remains the immutable `INSTALL_PROVEN` stable release.
- `main` is newer than `v4.0.0` and is subject to the active correction in
  `governance/release-corrections.json`.
- `governance/release-reviewers.json` remains unconfigured, so the independent
  release-review verifier fails closed.
- Signing-key rotation and recovery automation exist, but neither has current
  operational evidence.
- Current assistant compatibility is declaration-only. Real-task performance
  and external adoption remain explicitly not demonstrated.
- Local validation, coverage, fault injection, dependency audit, remote CI,
  security alerts, signed-tag verification, release asset digests, and GitHub
  attestations were independently rechecked during the audit.

### Required Outcome

The program is complete only when all of the following are true:

1. An active release hold cannot be bypassed by candidate, promotion, recovery,
   or direct release entry points.
2. The correction lifecycle supports an owner-authorized transition without
   creating a circular dependency between candidate evidence and stable
   publication.
3. Trusted reviewer identities, signer redundancy, protected publication, key
   rotation, and recovery evidence satisfy the governed release policy.
4. The preview compiler API cannot accidentally bypass schema and invariant
   validation through a neutrally named entry point.
5. Promotion and stable-install entry points have risk-proportionate coverage,
   mutation, and fault-injection gates.
6. Compatibility, performance, and adoption claims remain bounded until fresh,
   digest-bound external evidence exists.
7. Documentation, generated facts, CI, security, dependency, compliance, and
   release records all agree with the final implementation.

## Scope Boundaries

### In Scope

- Release correction enforcement and lifecycle design.
- Independent reviewer configuration and verification.
- Signer redundancy, key rotation, protected-environment proof, and recovery
  drill evidence.
- Preview package API hardening and migration guidance.
- Targeted test, coverage, mutation, and fault-injection expansion.
- Live assistant, real-task benchmark, compatibility, and adoption evidence.
- CI grouping, readiness reporting, dependency and security verification,
  compliance metadata, documentation, and generated fact synchronization.
- A new immutable candidate-to-stable publication only after all required
  gates are satisfied and publication is separately authorized.

### Out Of Scope

- Moving or deleting any existing `v*` tag.
- Retrofitting new evidence onto `v4.0.0` or treating later `main` history as
  evidence for that release.
- Self-approval, synthetic reviewer identities, fabricated protected-
  environment approvals, or automation-created owner decisions.
- Publishing private consumer facts, raw model transcripts, credentials,
  machine paths, endpoints, or private repository information.
- Activating a public portal, production multi-plugin layout, runtime dynamic
  loading, or broad new workflow surfaces without separate adoption evidence.
- Hand-editing generated marketplace, workflow, adapter, catalog, inventory, or
  fact outputs.

## Confirmed Risk Register

| ID | Severity | Confirmed condition | Required treatment | Closure evidence |
| --- | --- | --- | --- | --- |
| REL-001 | P0 / High | An active release hold exists and stable publication is forbidden | Enforce hold semantics at every release entry point and define a reviewed authorization lifecycle | Negative tests prove every entry point fails closed; exact authorized transition test passes |
| GOV-001 | P0 / High | Trusted users and teams are empty | Owner configures real independent identities; verifier checks final-head approvals | Digest-bound `independent-review.json` from the exact candidate commit |
| OPS-001 | High | One signer, no rotation evidence, no successful recovery drill | Add signer overlap, perform rotation rehearsal and non-publishing recovery drill | Reviewed signer inventory, signed test-tag verification, successful drill URL and evidence digest |
| API-001 | Medium | `compileDirectory()` accepts schema-invalid bundles while `compileValidatedDirectory()` rejects them | Remove or explicitly mark unchecked filesystem APIs and make validated loading the default | Unit and E2E tests reject invalid bundles through every normal package and CLI path |
| TST-001 | Medium | Global coverage passes, but promotion and stable-install wrappers lack critical floors | Add focused CLI/IO tests, critical floors, mutants, and faults | Target module floors pass and every new mutant is killed |
| EVAL-001 | Medium | Current assistant claims are declaration-only; historical live evidence is stale | Run clean-commit, digest-bound known-good and canary evaluations | Generated compatibility registry contains current evidence or remains honestly bounded |
| PERF-001 | Medium | Real-task benchmark has zero live samples | Execute the fixed benchmark only with credentials and budget | Non-zero sample counts, intervals, failure taxonomy, and source digests |
| ADOPT-001 | Medium | External adoption is not demonstrated | Collect at least two consented and redacted records | Governance schema passes with reproducible, digest-bound records |

### Audit Delta: Release Hold Enforcement

The correction is currently schema-validated and projected into the generated
fact graph, but candidate generation, promotion verification, and the release
state machine do not directly consume it. The current empty reviewer policy
still blocks a governed candidate, but reviewer configuration alone must never
turn an advisory hold into an accidental release path. REL-001 therefore comes
before all other release work.

## Thirteen-Dimension Remediation Matrix

| Dimension | Current evidence | Target state | Required work | Acceptance signal |
| --- | --- | --- | --- | --- |
| Product positioning | Single production plugin; portal and multi-plugin lanes deferred; adoption not demonstrated | Public claims remain evidence-derived and do not imply an ecosystem, portal, or proven adoption | Preserve generated product facts; add adoption and compatibility claim guards to documentation validation | README, roadmap, generated facts, compatibility, and adoption records agree |
| Architecture | Pure compiler and IO layers are separate; private preview packages have explicit boundaries | Validated loading is the normal filesystem path; unchecked compilation is explicit and internal | Harden package exports, document prevalidated-object versus filesystem APIs, retain pure `compileProductBundle()` | Invalid filesystem bundles cannot reach normal compilation |
| Implementation | Hook truth, marketplace version truth, path safety, shell broker, and audit logging are aligned | Release corrections are enforced as executable policy, not documentation only | Add a shared correction evaluator and call it from candidate, promotion, orchestrator, and recovery paths | Hold-bypass integration tests fail closed |
| API | CLI has stable JSON output and exit codes; compiler exposes checked and unchecked directory APIs | Neutral API names always validate; unchecked APIs are unmistakable or removed | Deprecate/rename unsafe exports, add stable error codes, update package docs and tests | API snapshot and migration tests pass |
| Data model | Current v5 contract, deterministic v6 projection, behavior IR, and adapters validate | Correction lifecycle and resolution evidence are machine-readable and non-circular | Extend correction schema with explicit lifecycle and evidence fields; regenerate facts | Schema conditionals reject premature or incomplete resolution |
| Tests | 34 unit, 19 integration, 4 E2E files; global and critical gates pass | Release entry points receive direct positive, negative, CLI, mutation, and recovery tests | Add promotion, install, hold, reviewer, rotation, and recovery cases | Full suite, new module floors, mutations, and fault injection pass |
| Performance | Validation timings exist; live task latency, tokens, and cost are unavailable | Deterministic local timings stay observable; live metrics have intervals and failure taxonomy | Preserve timing trend; execute fixed real-task plan only when external gates exist | No unavailable metric is coerced to zero; benchmark report has real `n` values |
| CI/CD | Main CI and CodeQL are green; release workflows use pinned actions and least privilege | PR integrity, release readiness, and publication authorization are distinct gates | Add readiness report/check, hold enforcement, evidence artifacts, and required-check documentation | Green validation cannot be mistaken for publishable status |
| Security | No open CodeQL, Dependabot, or secret-scanning alerts; hooks fail closed | Release policy, signer, archive, attestation, and install controls also fail closed | Add hold-bypass mutants, signer/recovery tests, remote settings readback, and security review | No unreviewed release transition succeeds |
| Dependencies | Locked dependencies; no current npm advisory; plugin archive has no Node runtime dependency | Upgrades remain exact, reviewed, license-compatible, and isolated from plugin distribution | Retain audit, dependency review, package-lock validation, SBOM comparison, and exact assistant package lanes | `npm audit`, dependency review, workspace validation, and SBOM checks pass |
| Compliance | MIT, package license fields, Security Policy, privacy docs, and CycloneDX SBOM exist | Release and evidence records remain traceable, redacted, and license-complete | Validate package/lock/SBOM license alignment and retention boundaries; keep raw private data out | Compliance checklist and distribution scan pass |
| Release | `v4.0.0` is signed, attested, digest-matched, and install-proven; current main is held | A new immutable candidate is independently reviewed, then promoted without byte drift and install-proven | Complete REL-001, GOV-001, OPS-001, candidate verification, protected promotion, and stable proof | Exact-tag ledger ends at `INSTALL_PROVEN`; stable facts match assets and install tree |
| Continuing governance | Active external gate and correction are source-controlled | Every external fact has an owner, cadence, expiry, and evidence reference | Add readiness status, reviewer/signer cadence, drill cadence, compatibility freshness, adoption review, and closure checklist | No null or stale release-critical evidence remains at publication time |

## Work Package 0: Freeze Publication And Establish Baseline

Priority: P0

Estimated effort: 0.5 person-day plus owner acknowledgment

### Changes

1. Record the exact implementation commit, stable tag, stable commit, current
   correction IDs, reviewer-policy digest, signer-list digest, and release-
   operations digest in the work-package evidence.
2. Confirm there is no open release PR, no newly created release tag, and no
   in-progress release workflow before modifying release policy.
3. Keep `v4.0.0` and its GitHub Release immutable.
4. Treat `node scripts/validate-all.mjs` and coverage success as local baseline
   evidence only.

### Acceptance

- Working tree scope is explicit.
- Existing stable tag signature and commit are unchanged.
- The active hold remains in force.
- No user-scope plugin state or remote release state is mutated.

## Work Package 1: Make Release Corrections Executable Policy

Priority: P0

Estimated effort: 2-3 person-days

### Proposed Files

- `scripts/lib/release-corrections.mjs`
- `scripts/validate-release-readiness.mjs`
- `scripts/generate-release-candidate.mjs`
- `scripts/verify-release-promotion.mjs`
- `scripts/release-orchestrator.mjs`
- `.github/workflows/release-candidate.yml`
- `.github/workflows/promote-release.yml`
- `.github/workflows/release-recovery-drill.yml`
- `schemas/release-corrections.schema.json`
- `governance/release-corrections.json`
- `governance/task-registry.json`
- `package.json`
- unit, integration, regression, workflow, and documentation tests

### Policy Model

Implement one shared evaluator that accepts:

- release mode: candidate, promote, recover, or drill;
- stable tag and candidate tag;
- exact source commit;
- correction records;
- independent-review evidence;
- protected-publication requirement;
- install-proof requirement where applicable.

Return a structured result with:

- `status`: `READY`, `BLOCKED_POLICY`, or `BLOCKED_EXTERNAL_GATE`;
- applicable correction IDs and source digest;
- required but missing evidence;
- the maximum permitted release state;
- a stable reason code for CI and release evidence.

### Correction Lifecycle

Replace the ambiguous two-state lifecycle with explicit stages:

1. `active-release-hold`: candidate rehearsal may run, but stable publication
   is prohibited.
2. `authorized-for-new-candidate`: an owner-reviewed decision identifies the
   target version and confirms that a new candidate may be created. It does not
   claim review, publication, or installation proof.
3. `candidate-verified`: exact candidate tag, commit, manifest digest, signer,
   and independent-review evidence are bound. Stable promotion remains subject
   to the protected environment.
4. `resolved-by-governed-release`: exact stable tag, release ledger head,
   published release, stable channel, and install proof are recorded after the
   release succeeds.

The schema must use conditional requirements so that later statuses cannot be
set without the corresponding evidence. A resolution must never be inferred
from a green CI run or from a manually edited status string.

### Enforcement Points

- Candidate preflight: require either no applicable hold or an authorized new-
  candidate decision; bind the correction digest into candidate evidence.
- Candidate generation: include correction IDs and digest in the candidate
  core and promotion intent.
- Promotion verification: reject missing, changed, unresolved, or mismatched
  correction evidence before any publication handoff is built.
- Release orchestrator: limit the highest reachable state according to the
  evaluator result.
- Recovery and drill: verify the same correction and ledger identity; drills
  must never cross `PROMOTION_READY`.
- Stable publication: run only behind the protected `release` environment and
  only from the exact verified handoff.

### Tests

- Active hold blocks promotion even when reviewer configuration is valid.
- Merely changing the status string without required evidence fails schema and
  runtime validation.
- An unrelated correction does not block a different release identity.
- Candidate evidence with one correction digest cannot be promoted after the
  correction file changes.
- Recovery cannot import correction policy from moving `main`.
- Direct orchestration cannot advance beyond the evaluator's permitted state.
- Drill mode remains non-publishing.

### Acceptance

- Every release entry point imports the shared evaluator.
- Release workflows contain an explicit readiness step before side effects.
- `validate-all`, regression tests, workflow validation, and mutation tests
  reject a hold-bypass fixture.
- Readiness output reports the current repository as blocked without causing
  ordinary development CI to be permanently red.

## Work Package 2: Close Independent Review And Operator Resilience

Priority: P0 / High

Estimated effort: 1-2 person-days of repository work plus external reviewer and
owner availability

### Owner-Gated Actions

1. Configure at least one trusted identity for standard changes and enough
   independent identities to satisfy the two-approval sensitive-path policy.
2. Keep PR author, candidate actor, and bot identities excluded as required.
3. Obtain approvals on the exact final head; dismiss or supersede stale
   approvals after any push.
4. Add a second authorized signing key during an overlap window without
   committing private key material.
5. Verify a disposable signed annotated tag locally and do not push it.
6. Run the non-publishing recovery workflow against an immutable signed RC.
7. Record reviewed rotation and recovery evidence in
   `governance/release-operations.json`.

### Repository Changes

- Strengthen `validate-release-operations.mjs` so release readiness, unlike
  structural validation, reports missing reviewer, signer, rotation, drill, or
  protected-environment evidence with stable reason codes.
- Keep ordinary repository validation green when operational evidence is
  honestly absent; expose readiness as a separate result.
- Add expiry/cadence validation for signer inventory review, rotation evidence,
  and recovery drills.
- Verify live GitHub rulesets, default workflow permissions, required checks,
  and protected environment configuration before a release decision.

### Acceptance

- Independent review evidence is bound to the exact candidate commit and final
  PR head.
- The signer allowlist has overlap evidence and at least two usable identities.
- The recovery drill succeeds without publication.
- The protected publication environment requires an external approval.
- No reviewer, signer, or environment fact is inferred from source code alone.

## Work Package 3: Harden Preview Package APIs

Priority: P1

Estimated effort: 1-2 person-days

### Changes

1. Preserve `compileProductBundle(bundle)` as the pure API for callers that
   already possess a validated in-memory bundle.
2. Make validated loading the only normally documented filesystem API.
3. Rename `loadSpecBundle()` and `compileDirectory()` to names containing
   `Unchecked`, or stop exporting them from the package root.
4. If compatibility aliases are temporarily retained, mark them deprecated,
   make the risk explicit, and set a removal milestone.
5. Keep schema-engine injection in `@llm-plugins-fusion/spec` so the compiler
   package does not acquire a hidden Ajv dependency.
6. Preserve stable `SPEC_*` error codes and CLI exit codes.
7. Update framework, migration, compatibility, and second-product docs.

### Tests

- Wrong types, unknown properties, duplicate IDs, missing behaviors, orphan
  behaviors, unknown stages, unsafe adapter paths, and symlink escapes fail
  before compilation.
- The pure in-memory compiler remains deterministic and free of filesystem,
  environment, clock, and process access.
- CLI `validate`, `build`, `test`, `eval`, `inspect`, and `migrate` all use the
  validated boundary.
- API export snapshots prevent accidental reintroduction of a neutral unchecked
  entry point.

### Acceptance

- The invalid-bundle reproduction used by the audit is rejected by every
  documented filesystem API.
- The second-product fixture still compiles without Nova, Claude, or Codex
  constants.
- No runtime dependency enters the distributed `nova-plugin` archive.

## Work Package 4: Strengthen Release-Critical Testing

Priority: P1

Estimated effort: 2 person-days

### Targeted Coverage Floors

Add floors only after tests make them sustainable:

| Module | Lines | Branches | Functions |
| --- | ---: | ---: | ---: |
| `verify-release-promotion.mjs` | 85 | 80 | 90 |
| `verify-stable-install.mjs` | 90 | 80 | 90 |
| `release-corrections.mjs` | 95 | 90 | 100 |
| `validate-release-readiness.mjs` | 90 | 85 | 90 |

Keep the global floors at or above 85% lines, 70% branches, and 90%
functions. Do not use permanent source exclusions or environment overrides as
release evidence.

### New Mutants

- Ignore an active correction.
- Accept a correction digest mismatch.
- Skip candidate-envelope binding.
- Skip control-bundle byte or inventory verification.
- Accept a stable tag that points to a different candidate commit.
- Accept a candidate/install tree digest mismatch.
- Accept an incomplete or expired recovery/rotation record.

### Fault Injection

- Truncated and malformed correction files.
- Concurrent or reordered release ledger events.
- GitHub API pagination, timeout, missing PR, dismissed review, and stale-head
  approval cases.
- Missing, duplicated, renamed, or replaced candidate assets.
- Attestation predicate, signer workflow, source ref, and source digest mismatch.
- Interrupted recovery drill and protected-environment denial.

### Acceptance

- All new mutants are killed by risk-bearing assertions.
- Critical module floors pass on Node.js 22, not only a newer local runtime.
- Linux, Windows, and macOS lanes preserve their documented Bash semantics.
- Coverage metadata lists the complete tracked maintenance source inventory.

## Work Package 5: Produce Live Compatibility And Performance Evidence

Priority: P1 for release claims; P2 for general development

Estimated effort: 2-5 person-days plus assistant credentials and evaluation
budget

### Preconditions

- Clean exact commit with no untracked source changes.
- Current workflow, adapter, runner, dataset, and locked-label digests.
- Exact known-good assistant versions plus non-blocking latest canaries.
- Isolated consumer fixtures and explicit zero-project-write rules.
- Credentials supplied only through approved runtime mechanisms.
- A reviewed budget and retry/rate-limit policy.

### Execution

1. Run the critical live set first and stop on any unauthorized write,
   invented surface, missing-approval failure, or adapter-load failure.
2. Run the complete bilingual and adversarial dataset with the required number
   of attempts.
3. Run the fixed 24-task benchmark across raw, wrapper-full, and
   wrapper-compact conditions for Claude Code and Codex.
4. Preserve derived metrics and redacted failure categories, not raw private
   prompts or credentials.
5. Generate confidence intervals for safety, task success, latency, tokens,
   and cost without coercing unavailable values to zero.
6. Bind evidence records to the exact source, runner, dataset, adapter, and
   assistant versions.

### Claim Rules

- L3/L4 requires current qualifying evidence; runner capability alone is not
  evidence.
- Known-good lanes may block; latest canaries remain drift detectors unless a
  separate policy change is approved.
- Failed or rate-limited runs remain failed or unavailable and are not silently
  omitted.
- Performance claims describe the measured fixture and environment only.

### Acceptance

- Current compatibility records no longer point only to stale evidence, or the
  effective level remains explicitly bounded.
- Benchmark metrics have non-zero sample counts and valid intervals.
- Failure taxonomy and raw-data retention boundary are documented.
- The generated quality report and public documentation match the evidence.

## Work Package 6: Establish External Adoption Evidence

Priority: P2

Estimated effort: external-calendar dependent

### Changes

1. Define a consent record that permits publication of redacted, aggregate
   workflow evidence without exposing consumer identity or private facts.
2. Collect at least two independently maintained consumer records containing
   every field required by `governance/adoption-evidence.json`.
3. Bind each record to a public-safe source digest and validation artifact.
4. Review each record for local paths, endpoints, repository names,
   credentials, business rules, and private knowledge-base content.
5. Change adoption status only after schema and privacy validation pass.

### Acceptance

- At least two consented, redacted, reproducible records exist.
- Internal fixtures, stars, downloads, and maintainer self-reports are not
  counted as external adoption.
- Product positioning changes, if any, are separately reviewed.

## Work Package 7: CI/CD, Security, Dependency, And Compliance Closure

Priority: P1

Estimated effort: 1-2 person-days

### CI/CD

- Add `validate:release-readiness` and `check:release-readiness` as explicit
  tasks with generated task-catalog coverage.
- Keep `validate-all` as integrity validation; do not make ordinary PRs fail
  forever because external release evidence is absent.
- Make release workflows require readiness `READY` before side effects.
- Upload readiness, correction digest, reviewer evidence, signer evidence,
  coverage, timing, SBOM, attestation, and ledger artifacts.
- Retain pinned actions, fixed argv, minimal permissions, and platform lanes.
- Update required-check documentation and regression tests when job names or
  grouping changes.

### Security

- Re-run CodeQL, secret scanning, Dependabot, distribution risk, shell policy,
  hook runtime smoke, archive extraction, and release fault injection.
- Verify live repository rulesets, workflow permissions, and protected
  environment settings.
- Preserve fail-closed behavior when Node, review identity, signer evidence,
  attestation, or required release evidence is unavailable.

### Dependencies

- Install only the locked toolchain with `npm ci --ignore-scripts`.
- Run `npm audit --audit-level=high`, Dependency Review, workspace validation,
  and exact assistant package integrity checks.
- Review every dependency change for license, release notes, Node.js 22 support,
  transitive growth, and impact on the distributed plugin archive.
- Keep optional platform packages and private workspaces out of public runtime
  dependency claims.

### Compliance

- Confirm MIT/SPDX fields across root and workspace manifests.
- Compare package-lock licenses with denied-license policy.
- Verify build and runtime CycloneDX documents, release checksums, and asset
  digests.
- Preserve private vulnerability reporting and local audit-log privacy,
  retention, disable-switch, and redaction documentation.
- Never treat best-effort redaction as permission to publish raw logs.

### Acceptance

- Local and remote security gates have no unresolved high or critical findings.
- Dependency and license checks pass without suppressing relevant findings.
- Generated SBOMs and release assets are mutually consistent.
- CI clearly distinguishes integrity, readiness, and publication states.

## Work Package 8: Documentation And Generated Truth

Priority: P1

Estimated effort: 1 person-day

### Changes

- Update `CLAUDE.md` and `AGENTS.md` only if inventory or non-Claude behavior
  changes.
- Update framework API, release runbook, release hygiene, recovery/rotation,
  security settings, validation index, task catalog, and this plan.
- Add correction lifecycle, readiness reason codes, and external-gate semantics
  to the source-of-truth documentation.
- Regenerate task catalog, fact graph, project state, registry outputs,
  workflow permissions, adapters, runtime contracts, quality report, and
  surface inventory only when their source domains change.
- Correct any active documentation that still states a superseded coverage
  threshold or release status.
- Update `CHANGELOG.md` when behavior, safety boundaries, APIs, versioning, or
  release semantics change.

### Acceptance

- Documentation validation and link checks pass.
- No active document describes held `main` as release-ready.
- No generated file is hand-edited.
- Public docs contain no private consumer or machine facts.

## Work Package 9: Governed Candidate And Stable Release

Priority: blocked until Work Packages 1, 2, 4, 5, 7, and 8 satisfy their
release-relevant exit criteria and an owner separately authorizes publication

Estimated effort: 1 person-day plus external approvals and workflow time

### Candidate

1. Choose the SemVer increment from the actual public behavior and API delta.
2. Update canonical version and release sources; regenerate projections.
3. Merge through current independent review with all required checks green.
4. Create one signed annotated RC tag on the exact reviewed commit.
5. Run candidate preflight, full validation, coverage, artifacts, checksums,
   exact assistant package verification, protected live smoke, isolated install
   smoke, candidate bundle, SBOM attestation, and candidate publication.
6. Stop if any evidence is missing, skipped without an allowed replacement, or
   bound to another commit.

### Stable Promotion

1. Create the signed stable tag on the same commit as the verified candidate.
2. Verify both tag signatures and identical commit identity.
3. Download the original candidate bundle and verify its signer workflow,
   predicate, source ref, and source digest.
4. Verify candidate core, intent, correction evidence, control bundle,
   required evidence, artifact bytes, checksums, and deterministic rebuild.
5. Build a digest-bound handoff and enter the protected release environment.
6. Publish the original verified candidate bytes without rebuilding the release
   payload.
7. Pin stable channel facts to the exact tag and commit.
8. Install from the stable channel in an isolated home and compare the installed
   tree digest with the promoted candidate tree.
9. Advance the ledger to `INSTALL_PROVEN` and then record correction resolution
   on `main` through a reviewed follow-up change.

### Acceptance

- Candidate and stable tags are immutable, signed, and point to one commit.
- GitHub Release assets, checksums, SBOMs, attestations, candidate manifests,
  channel facts, and install proof agree.
- Release ledger continuity is complete and digest-valid.
- Correction status is resolved only after publication and install evidence
  exist.
- A failed publication is recovered forward with a new patch candidate; tags
  are never rewritten.

## Work Package 10: Continuing Governance

Priority: ongoing

### Cadences

| Control | Minimum cadence | Owner evidence |
| --- | --- | --- |
| Reviewer inventory | Before every candidate and after membership changes | Reviewed policy diff and verifier output |
| Signer inventory | Every 90 days and before release | Allowlist review date and active-key proof |
| Key rotation | Every 90 days or on suspected compromise | Overlap, test-tag, retirement, and incident evidence |
| Recovery drill | Every 90 days and after release-control changes | Successful non-publishing workflow run |
| Known-good assistant evidence | Before compatibility upgrade and after relevant source drift | Digest-bound live evidence |
| Latest assistant canary | Scheduled, non-blocking | Drift issue or generated summary |
| Dependency and license review | Every dependency PR and scheduled security run | Dependency Review, npm audit, SBOM comparison |
| Adoption review | Quarterly or when new records arrive | Consented redacted records and privacy review |
| Performance baseline | Before material performance claims and after runner changes | Fixed-plan report with intervals and failure taxonomy |

### Governance Rules

- Every current fact must have one source, owner, review cadence, and evidence
  path.
- `null`, stale, skipped, or declaration-only values remain visible; they are
  never coerced into success.
- Generated facts project source truth but do not replace operational proof.
- Product expansion remains gated by adoption, maintenance ownership, threat
  model, compatibility impact, and rollback strategy.

## Dependency Graph And Execution Order

```text
WP0 Baseline
  -> WP1 Release hold enforcement
       -> WP2 Reviewer and operator resilience
       -> WP4 Release-critical testing
       -> WP7 CI/security/dependency/compliance
  -> WP3 Preview API hardening
       -> WP4 Release-critical testing
  -> WP5 Live compatibility/performance evidence
  -> WP6 Adoption evidence

WP1 + WP2 + WP4 + WP5 + WP7 + WP8
  -> owner publication authorization
  -> WP9 Governed candidate and stable release
  -> WP10 Continuing governance
```

WP3 and WP6 may proceed without publication. WP5 may proceed only when external
credentials and evaluation budget are available. WP9 must not begin merely
because local implementation work is complete.

## Validation Strategy

### Focused During Implementation

```bash
node scripts/validate-schemas.mjs
node scripts/validate-release-operations.mjs
node scripts/validate-release-readiness.mjs
node scripts/validate-github-workflows.mjs
node scripts/generate-fact-graph.mjs
node scripts/generate-task-catalog.mjs
node --test tests/unit/<changed-suite>.test.mjs
node --test tests/integration/<changed-suite>.test.mjs
git diff --check
```

### Full Local Gate

```bash
npm ci --ignore-scripts
npm test
npm run test:coverage:check
npm run test:mutation:critical
npm run test:fault-injection
npm run typecheck
npm run lint:shell
npm run lint:actions
npm audit --audit-level=high
node scripts/validate-plugin-install.mjs --dry-run
node scripts/scan-distribution-risk.mjs
node scripts/validate-all.mjs --write-timings
git diff --check
git diff --cached --check
```

ShellCheck and actionlint count as passed only when the executables actually
run. Bash-dependent checks count as passed only when Bash runs. The plugin
install dry run proves planning and inventory only; it does not prove a real
user-scope installation.

### Remote Gate

- Required Aggregate, Dependency Review, and CodeQL succeed on the exact head.
- Linux Node 22, additional supported Node, Windows Node, Windows Bash, and
  macOS lanes finish with their documented semantics.
- No unresolved CodeQL, Dependabot, secret-scanning, or dependency-review
  finding remains.
- Branch and tag rulesets, default workflow permissions, and protected release
  environment are read back from GitHub.
- Candidate and stable workflows use the exact reviewed commit.

## Rollback And Failure Policy

| Failure | Response |
| --- | --- |
| Hold enforcement blocks ordinary development CI | Separate integrity validation from release readiness; do not weaken the release gate |
| Correction lifecycle is ambiguous or circular | Stop publication work and revise the schema/state model through review |
| Reviewer identities are unavailable | Continue non-release work; do not self-approve or lower thresholds |
| Signer or protected environment is unavailable | Do not create a candidate or stable tag |
| Candidate workflow fails | Fix forward and create a new immutable RC tag |
| Stable publication fails after tag creation | Preserve the tag and recover with a new patch release |
| Live evaluation is rate-limited or unauthenticated | Record unavailable/failed evidence and retain current compatibility level |
| Performance sample is incomplete | Publish no aggregate performance claim |
| Adoption record fails privacy review | Exclude it; do not lower the minimum record count |
| API hardening breaks internal consumers | Use a bounded deprecation alias, document migration, and remove only after repository consumers migrate |

## Final Definition Of Done

The modification program is done only when:

- all confirmed findings have code, test, documentation, and evidence closure;
- release correction policy is enforced at runtime and in workflows;
- independent review and operator evidence are current and non-forgeable;
- preview filesystem APIs validate by default;
- critical release wrappers meet their coverage and mutation floors;
- live and adoption claims either have qualifying evidence or remain explicitly
  unavailable;
- local and remote gates pass on the final exact commit;
- generated outputs are current and the worktree contains no runtime artifacts;
- any release is signed, attested, digest-bound, ledger-complete, stable-pinned,
  and install-proven; and
- this document is updated with actual evidence rather than prospective status.

Until then, the correct status is:

```text
LOCAL_ENGINEERING_READY / RELEASE_BLOCKED / LIVE_AND_ADOPTION_EVIDENCE_PENDING
```

## Execution Record

Execution date: 2026-07-13

No commit, push, PR, tag, GitHub setting change, user-scope installation, or
release publication was performed. The pre-existing `docs/README.md` change
and this plan were preserved and extended.

| WP | Modification target and actual files | Verified facts and checks | Skipped checks, external gates, and residual risk |
| --- | --- | --- | --- |
| WP0 | Freeze the baseline; this plan and `docs/README.md`. | Repository root and branch `main` verified; initial HEAD `ab35580924471b6561a225de6ba6293dbd9fc176`; no open PR or in-progress workflow; initial `validate-all` passed with `failed=0 skipped=0`; active hold and unsafe Preview API reproduced. | Stable tag and remote state were read only. No remote mutation. |
| WP1 | Executable release correction lifecycle in `schemas/release-corrections.schema.json`, `governance/release-corrections.json`, `scripts/lib/release-corrections.mjs`, readiness/candidate/promotion/orchestrator scripts, and release workflows. | Focused schema, correction, candidate, promotion, recovery, and orchestrator tests pass. Active holds produce `BLOCKED_POLICY`, exact identity and correction digests are bound, drills stop at `PROMOTION_READY`, and protected publication is checked before side effects. | Current correction lacks owner authorization, so candidate and stable release remain blocked. |
| WP2 | Independent-review and operator resilience in reviewer/operations governance, schemas, operational-readiness validator, workflows, tests, and operator runbook. | Empty reviewers, one signer, missing rotation, missing drill, and missing protected-environment evidence return stable external-gate reason codes. Configuration absence never passes. | Owner identities, second signer, rotation rehearsal, recovery run, and protected-environment readback require external action. |
| WP3 | Validated Preview API defaults in the spec/compiler/CLI packages; API, framework, migration, and second-product docs; unit and E2E tests. | `loadSpecBundle()` and `compileDirectory()` validate by default; unchecked APIs contain `Unchecked`; `compileValidatedDirectory()` is deprecated until 5.0.0; stable `SPEC_*` and CLI exit semantics remain. | The unchecked escape hatch remains intentionally explicit for prevalidated callers. |
| WP4 | Release-critical coverage, mutation, and fault injection in `governance/critical-coverage.json`, mutation/fault runners, and new suites. | Hold-ignore and identity-bypass mutants are included; readiness/correction suites are included in fault injection; focused suites pass. Final coverage, mutation, and fault commands are recorded below. | Floors may only be accepted if final coverage observes them; no exclusion or threshold override is allowed. |
| WP5 | Compatibility/performance evidence boundaries in existing live runners, fixed 24-task benchmark, generated benchmark report, compatibility registry, and docs. | The local framework reports 432 planned invocations, `n=0`, unavailable intervals, and no aggregate performance conclusion; declaration-only compatibility remains L2/L1. | Claude/Codex credentials and evaluation budget unavailable; live runs not executed. |
| WP6 | Privacy-preserving adoption model in its schema, governance source, validator, facts, and docs. | Consent, redaction, retention, withdrawal, and distinct installation/activation/success/maintenance signals are machine-readable; zero records keeps `not-demonstrated`. | Two consented independent consumer records do not exist and were not fabricated. |
| WP7 | CI/CD, security, dependency, and compliance changes in release/CI workflows, package scripts, schemas, critical gates, and validation docs. | Release readiness is separate from PR integrity; workflows remain pinned, permission-bounded, concurrent, timeout-bounded, and fail closed. Final ShellCheck, actionlint, audit, distribution, and workflow results are recorded below. | Live ruleset, alert, required-check, and protected-environment readback remain external exact-head gates. |
| WP8 | Generated truth and documentation in fact/project-state/task generators, governance sources, docs indexes, runbooks, `CHANGELOG.md`, and generated outputs. | Generated outputs are regenerated from sources and drift checks are part of final validation. Product remains a single-plugin workflow framework; generated facts do not claim operational proof. | No marketplace source changed; marketplace outputs are generator-verified. |
| WP9 | Candidate/stable local preparation through release readiness, dry-run install, deterministic assets, SBOM/checksum/ledger contracts. | All authorized local dry-runs and validators are run below. Current readiness intentionally remains `RELEASE_BLOCKED`. | No owner publication authorization, correction closure, independent approvals, signer redundancy, live evidence, protected approval, immutable new RC, or stable install proof. No tag/release action performed. |
| WP10 | Continuing governance in `governance/evidence-governance.json`, freshness validator/tests, fact graph, task catalog, and this execution record. | Each governed fact has a source, owner role, cadence, expiry, evidence path/status; unavailable facts remain visible as `EVIDENCE_PENDING`. | Periodic evidence collection is ongoing owner work; it cannot be completed from repository code alone. |

### Final Validation Evidence

The final command outcomes are recorded from observed output at the end of the
run. A dry run proves planning and inventory only, not a real install.

| Command | Observed result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed; 15 packages installed and npm reported 0 vulnerabilities. |
| `npm test` | Passed; unit 172/172, integration 87/87, and end-to-end 7/7. |
| `npm run test:coverage:check` | Passed; global lines 88.13%, branches 71.74%, functions 91.24%; 22 critical floors passed; 141/141 maintenance modules loaded. |
| `npm run test:mutation:critical` | Passed; 9/9 critical mutants killed (100%). |
| `npm run test:fault-injection` | Passed; 83/83 tests across 13 critical suites. |
| `npm run typecheck` | Passed. |
| `npm run lint:shell` | Unavailable locally because `shellcheck` is not installed; no pass is claimed. Bash syntax and runtime checks did execute successfully inside `validate-all`. |
| `npm run lint:actions` | Unavailable locally because `actionlint` is not installed; no pass is claimed. The repository workflow contract validator passed. |
| `npm audit --audit-level=high` | Passed; 0 vulnerabilities. |
| `node scripts/validate-plugin-install.mjs --dry-run` | Passed; no Claude command and no user-scope mutation was executed. |
| `node scripts/scan-distribution-risk.mjs` | Passed. |
| `node scripts/validate-all.mjs --write-timings` | Passed; `failed=0 skipped=0`, including executed Bash syntax/runtime checks and generated-fact drift checks. |
| `git diff --check` and `git diff --cached --check` | Passed. |

Remote exact-head checks, live assistant evaluation, qualifying adoption
records, configured independent reviewers, signer rotation/recovery evidence,
protected-environment approval, tags, and publication remain external gates.
The resulting status is therefore:

```text
LOCAL_ENGINEERING_READY / RELEASE_BLOCKED / LIVE_AND_ADOPTION_EVIDENCE_PENDING
```

</details>

<!-- merged-from: docs/project-optimization-plan.md -->
<details>
<summary>Migrated source: docs/project-optimization-plan.md</summary>

# Project Optimization Plan

<!-- generated:project-state:start -->
## Current Machine-Derived Project Facts

Do not edit this block by hand. It is synchronized by
`node scripts/sync-doc-facts.mjs --write` from repository domain sources and
`governance/product-lanes.json`.

- Plugin: `nova-plugin@4.0.0`; production plugins: 1; public path: `nova-plugin/`
- Runtime: Node.js `>=22`; distributed Bash helpers: `3.2+`
- Inventory: 21 commands, 6 skills, 6 active agents, 8 capability packs
- Workflow contract: schema v5, namespace `nova-plugin`, 21 workflows
- Evaluation datasets: `live-paired` has 168 cases and 1008 planned paired invocations; `real-task-benchmark` has 24 tasks and 432 planned invocations
- Package scripts: `check` is present; `build` is absent
- Active product lanes: `workflow-framework`, `single-plugin-delivery`, `release-candidate-promotion`, `live-assistant-evaluation`, `generic-framework-kernel`
- Planned product lanes: None
- Deferred product lanes: `production-multi-plugin-layout`, `public-portal`, `runtime-dynamic-loading`, `broad-domain-command-expansion`
- Release model: `candidate-and-promotion`
- Active PreToolUse launcher: `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh`, `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-bash-check.sh`
- Active PostToolUse launcher: `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-write-verify.mjs`, `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-audit-log.mjs`
<!-- generated:project-state:end -->

Status: archived
Date: 2026-07-09
Scope: post-`v2.3.0` optimization roadmap for `llm-plugins-fusion`

## Executive Summary

Continue the project as a `nova-plugin` centered AI engineering workflow
framework. Promote released tags, not unreleased `main` snapshots. Keep
Public portal work and production multi-plugin directory migration remain
deferred until real maintenance pressure appears. These are independently
named product lanes and are not coupled to an already released version number.

This document is an archived optimization record. Tracks 1 through 5 have been
implemented for the `v2.2.0` release-ready work. Track 6 has been resolved by
removing stale archive documentation from the public working tree rather than
keeping a second active archive surface. The 2026-05-12 unattended P0-P2 pass
added maintainer npm shortcuts, consumer profile scaffolding, regression
checks, workflow evaluation fixtures, and expanded distribution-risk scanning.
The exact `v4.0.0` tag and GitHub release provide the current stable promotion
baseline; later `main` commits remain development snapshots until the next
release tag.

Primary optimization sequence:

1. Product positioning and promotion language.
2. First-use command path.
3. Workflow reliability examples and review rubrics.
4. Fact drift validation.
5. Environment and release evidence.
6. Retired archive cleanup and active-agent surface protection.
7. Reliability guardrail hardening.
8. Maintainer diagnostics and workflow check repeatability.

## Deep Research Follow-Up Execution Plan

Status: archived follow-up plan
Date: 2026-07-09

This section converts the deep research findings into repository-local work
packages. It does not supersede the completed optimization tracks below. It
tracks both the current follow-up slice and the remaining sequence for
validator maintainability, measurable coverage, portability, no-credential
demos, release proof, and first contribution flow.

### Follow-Up Baseline

Live facts checked for this plan:

- `nova-plugin` remains the only production plugin.
- The historical public inventory was 21 commands and 21 one-to-one `nova-*` skills, with 6
  active core agents, and 8 documentation capability packs.
- `scripts/validate-docs.mjs` remains the stable CLI entry point. The
  implementation has started moving under `scripts/validate-docs/` so rule
  families can be reviewed without changing the command contract.
- Tests are split across unit, integration, and e2e suites with explicit
  Node.js 22+ discovery. Coverage checks enforce the recorded 85% lines,
  60% branches, and 90% functions baseline.
- The historical baseline predated the current locked Ajv and YAML development dependencies.
- `validate-all` timing support, workflow fixtures, issue forms, release
  evidence artifacts, Windows Node smoke, Windows Bash smoke, and isolated
  install smoke already exist. Follow-up work should extend these controls, not
  describe them as missing from scratch.
- Hook secret rules are already centralized in `nova-plugin/runtime/secret-rules.mjs`,
  but the active hook entry still runs through Bash.

### Follow-Up Guardrails

- Keep `CLAUDE.md` as the canonical source for repository facts, workflows,
  quality gates, and source-of-truth routing.
- Do not update `AGENTS.md` or `CLAUDE.md` unless inventory, source-of-truth
  rules, or non-Claude execution behavior actually changes.
- Keep public content free of private consumer names, local machine paths,
  endpoints, credentials, repository addresses, runtime flags, business rules,
  and private knowledge-base content.
- Preserve a zero-package-runtime distributed plugin. Development-only npm
  dependencies require an explicit supply-chain decision, an exact lockfile,
  install scripts disabled in CI, and a lower-risk alternative review. Ajv is
  the approved exception for standards-complete schema validation.
- Do not commit `.codex/`, `.metrics/`, coverage output, logs, caches, or local
  runtime artifacts unless a file is deliberately promoted as a documented,
  source-controlled fixture.
- Do not hand-edit generated marketplace outputs. Edit source files and run
  `node scripts/generate-registry.mjs --write` when generated outputs must
  change.
- Bash-dependent checks count as locally passed only when Bash actually runs.
  Windows warning-skips must be recorded as skipped, not passed.
- Do not start public portal work, production multi-plugin directory migration,
  runtime dynamic loading, large domain command families, or a custom
  coding-agent runtime as part of this follow-up plan.

### Follow-Up Work Packages

| ID | Priority | Work package | Status | Estimate | Main validation |
| --- | --- | --- | --- | ---: | --- |
| DR0 | P0 | Baseline and execution controls | Complete for the 2026-07-09 slice; repeat for future slices | 0.5-1 day | `npm run validate:maintainer` |
| DR1 | P0 | Modularize `validate-docs` safely | Started; stable wrapper and first rule modules extracted | 5-7 days | docs, regression, tests, maintainer gate |
| DR2 | P0 | Coverage and timing evidence | Complete: full maintenance source inventory and blocking thresholds enforced | 2-3 days | tests, coverage, workflow validation |
| DR3 | P0 | Hook portability and Bash boundary | Started; Node helpers added while Bash remains active | 4-6 days | hooks, runtime smoke, tests, Windows CI |
| DR4 | P1 | Headless public-safe demo harness | Implemented for route, review, and verification fixtures | 3-5 days | workflow fixtures, docs, demos |
| DR5 | P1 | Toolchain and release-proof artifacts | Implemented for `.node-version`, checksums, SBOM, provenance, and attestation; candidate promotion remains active work | 2-4 days | workflow validation, release dry run |
| DR6 | P1 | First-contribution and issue flow | Started with public-safe first-contribution guidance | 1-2 days | docs validation |
| DR7 | P2 | README information-density pass | Started; continue as positioning-only refinements | 1 day | docs validation |
| DR8 | P0 | Final review and release readiness | Pending final local review and CI evidence | 1-2 days | maintainer gate, CI, release evidence |

### DR0: Baseline And Execution Controls

Objective: establish fresh live-state evidence before any implementation.

Steps:

1. Inspect the branch and worktree.

   ```bash
   git status --short --branch
   ```

2. Scan the live tree before grouping work units.

   ```bash
   rg --files -uu
   ```

   Exclude `.git/`, `.codex/`, dependency directories, build outputs, IDE
   directories, caches, coverage, logs, temporary files, and runtime artifacts.

3. Run a non-mutating baseline gate.

   ```bash
   node scripts/validate-all.mjs --write-timings
   npm run validate:maintainer
   git diff --check
   ```

4. Record skipped checks explicitly. If Bash is unavailable locally, use
   CI/Linux or CI/Windows Bash smoke as replacement evidence before promotion.

Acceptance criteria:

- Baseline command output is recorded in the implementation handoff or PR.
- Initial diffs and runtime artifacts are understood before package work starts.
- Runtime artifacts remain untracked.

### DR1: Modularize `validate-docs` Safely

Objective: reduce validator maintenance concentration without weakening current
documentation contracts.

Primary files:

- `scripts/validate-docs.mjs`
- `scripts/validate-docs/`
- `scripts/validate-regression.mjs`
- `tests/unit/`
- `tests/integration/`
- `docs/maintainers/validation-index.md` when user-facing validation output
  changes

Execution steps:

1. Add or extend regression fixtures before moving logic.
2. Keep `node scripts/validate-docs.mjs` as the stable CLI wrapper.
3. Extract shared utilities first: path filtering, Markdown link/anchor
   parsing, regex expectation helpers, inventory counters, and error/warning
   collection.
4. Move rule families in small reviewable batches:
   - links, anchors, and command docs
   - version, inventory, positioning, and release promotion contracts
   - maintainer, marketplace, contribution, issue intake, and docs index
     contracts
   - consumer, prompt, data handling, workflow evidence, showcase, growth,
     assets, deferred portal, multi-plugin readiness, security range, stale planning, and
     report archive contracts
5. Run focused tests after each extraction batch and the maintainer gate before
   merge.

Acceptance criteria:

- The CLI contract and active docs result remain stable.
- Each extracted rule family has at least one seeded failing fixture or
  regression assertion.
- Troubleshooting guidance remains accurate or is updated in the same package.
- No generated marketplace output changes.

Validation:

```bash
node scripts/validate-docs.mjs
node scripts/validate-regression.mjs
npm test
npm run validate:maintainer
git diff --check
```

Rollback:

- Revert the latest extraction batch only. Keep earlier behavior-preserving
  batches if they already passed review.

Subagent use:

- Use read-only explorer agents for rule-family mapping.
- Use one worker at a time for this package because the validator and tests
  share a tight write surface.

### DR2: Coverage And Timing Evidence

Objective: make test coverage and validation runtime observable while
preserving the no-dependency default.

Primary files:

- `package.json`
- `scripts/`
- `tests/`
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `docs/maintainers/validation-index.md`
- `docs/releases/release-validation-runbook.md`
- `docs/releases/release-evidence-template.md`

Execution steps:

1. Verify the minimum supported Node.js 22 CI lane supports the selected coverage
   approach. Local newer Node behavior is not enough.
2. Prefer Node's built-in test coverage path or a dependency-free normalizer.
   Add npm tooling only after a supply-chain review.
3. Add shortcuts such as `npm run test:coverage` and
   `npm run test:coverage:check`.
4. The observed baseline has been promoted: `--check` requires every
   Git-tracked non-test maintenance `.mjs` and enforces lines 85%, branches
   60%, functions 90% without permanent exclusions.
5. Upload coverage and validation timing artifacts from CI or release workflows.
   `validate-all` already supports timing output, so this work should make that
   evidence easier to retrieve rather than invent a second timing system.
6. Document that local coverage and `.metrics/` outputs are runtime artifacts
   and must not be committed unless deliberately promoted as fixtures.

Acceptance criteria:

- Coverage can be collected on the Node.js 22 CI lane.
- Blocking thresholds are conservative, cover the full maintenance inventory,
  and pass on the Node.js 22 CI lane.
- Validation timing evidence is available from CI or release artifacts.
- No npm dependency is added without an explicit decision.

Validation:

```bash
npm test
npm run test:coverage
npm run test:coverage:check
node scripts/validate-github-workflows.mjs
node scripts/validate-docs.mjs
npm run validate:maintainer
git diff --check
```

Rollback:

- Revert the faulty coverage implementation while retaining the last verified
  blocking baseline; do not lower thresholds or exempt maintenance modules to
  make a release pass.

### DR3: Hook Portability And Bash Boundary

Objective: reduce Windows friction and clarify whether active hooks should rely
on Bash, Node, or both.

Primary files:

- `nova-plugin/hooks/hooks.json`
- `nova-plugin/hooks/scripts/`
- `nova-plugin/runtime/secret-rules.mjs`
- `scripts/validate-hooks.mjs`
- `scripts/validate-runtime-smoke.mjs`
- `tests/unit/`
- `tests/integration/`
- `nova-plugin/docs/architecture/hooks-design.md`
- `docs/marketplace/compatibility-matrix.md`

Decision gate:

- If the active hook command switches from Bash to Node, update compatibility
  docs, hook design docs, validation docs, release notes, and semver assessment
  in the same package.
- If Node cannot be required for hook runtime users, keep Bash as the active
  hook path and treat Node scripts as compatibility helpers until a later
  release decision.

Execution steps:

1. Capture current Bash hook behavior with fixture tests before adding Node
   equivalents.
2. Implement Node hook scripts that read stdin JSON, reuse shared secret rules,
   preserve audit redaction, and return the same block/allow semantics.
3. Keep Bash scripts during transition as wrappers or compatibility smoke
   targets.
4. Update `hooks.json` only after validators, docs, and semver review agree on
   the new active runtime.
5. Extend `validate-hooks` and runtime smoke to validate the active path and any
   retained compatibility path.
6. Ensure Windows Node smoke covers the active hook path. Keep Windows Bash
   smoke while Bash scripts remain distributed.

Acceptance criteria:

- Active hook runtime is explicit in docs and compatibility matrix.
- Secret-like write payloads are still blocked.
- Audit log entries still redact sensitive command or content fragments.
- Bash-dependent checks are not claimed as active-hook evidence if hooks become
  Node-active.

Validation:

```bash
node scripts/validate-hooks.mjs
node scripts/validate-runtime-smoke.mjs
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
npm test
node scripts/validate-docs.mjs
npm run validate:maintainer
git diff --check
```

Rollback:

- Restore `hooks.json` to the Bash command and keep Node scripts non-active
  until behavior parity is repaired or the scripts are removed.

### DR4: Headless Public-Safe Demo Harness

Objective: provide a no-credential demo path that explains the framework
without requiring Claude Code, Codex CLI, marketplace install, network access,
or private consumer context.

Primary files:

- `fixtures/demo/` or `fixtures/workflow/`
- `scripts/demo-*.mjs`
- `scripts/validate-workflow-fixtures.mjs`
- `package.json`
- `docs/getting-started.md`
- `docs/examples/README.md`
- `docs/workflows/source-controlled-checks.md`

Execution steps:

1. Define 2 or 3 public-safe fixtures for route recommendation, plan/review
   signals, and verification evidence.
2. Keep fixture content fictional and generic.
3. Add deterministic demo scripts that print expected route, required inputs,
   output signals, and failure signals. Do not call Claude, Codex, network
   tools, or mutating install paths.
4. Add `npm run demo:*` shortcuts only for deterministic scripts.
5. Extend workflow fixture validation so demos cannot drift from documented
   expected signals.
6. Link the demo path from getting-started and examples docs.

Acceptance criteria:

- A new user can run the demo on a clean Node environment.
- Demo output does not pretend to execute an LLM command.
- Demo fixtures are covered by validation.
- Public-safe boundaries are documented and validated.

Validation:

```bash
npm run demo:route
npm run demo:review
node scripts/validate-workflow-fixtures.mjs
node scripts/validate-docs.mjs
npm run validate:maintainer
git diff --check
```

Rollback:

- Remove npm demo shortcuts and keep the fixtures as examples if the scripts
  become misleading.

### DR5: Toolchain And Release-Proof Artifacts

Objective: improve reproducibility and release trust while keeping build/runtime
BOMs, build records, and GitHub attestations as verified release evidence.

Primary files:

- `.node-version` or `mise.toml`
- `docs/maintainers/quickstart.md`
- `docs/maintainers/validation-index.md`
- `.github/workflows/release.yml`
- `.github/workflows/ci.yml`
- `docs/releases/release-validation-runbook.md`
- `docs/releases/release-evidence-template.md`
- `ROADMAP.md` only if deferred release automation decisions change

Execution steps:

1. Choose the smallest toolchain manifest that helps maintainers. Keep
   `package.json` `engines.node` canonical.
2. Add release checksums for selected source-controlled release artifacts:
   `nova-plugin/.claude-plugin/plugin.json`,
   `.claude-plugin/marketplace.json`,
   `.claude-plugin/marketplace.metadata.json`, and
   `docs/marketplace/catalog.md`.
3. Upload checksum artifacts in release workflow. Do not include local runtime
   paths or machine-specific data.
4. Validate build/runtime BOMs, build record, attestation inputs, and release notes before
   candidate promotion; stable publication must reuse candidate artifacts.
5. Update release docs so evidence separates exact-tag validation,
   generated-output drift, dry-run plugin install, isolated mutating install
   smoke, checksums, and optional future provenance.

Acceptance criteria:

- Maintainers can see the intended Node baseline before running checks.
- Release workflow publishes checksums for selected release artifacts.
- No new package dependency is added solely to produce checksums.
- Docs describe the implemented SBOM and attestation boundary without claiming
  that provenance alone proves artifact safety.

Validation:

```bash
node scripts/validate-github-workflows.mjs
node scripts/validate-docs.mjs
npm run validate:maintainer
git diff --check
```

Rollback:

- Remove checksum upload from the release workflow while leaving release
  validation unchanged.

### DR6: First-Contribution And Issue Flow

Objective: make early community contribution easier without implying a mature
community flywheel or public portal.

Primary files:

- `README.md`
- `CONTRIBUTING.md`
- `.github/ISSUE_TEMPLATE/`
- `.github/pull_request_template.md`
- `docs/maintainers/quickstart.md`

Execution steps:

1. Add a short first-contribution path for docs clarification, fixture updates,
   validator message improvements, and public-safe example improvements.
2. Add a label convention for `good first issue` and `help wanted`. If labels
   are not source-controlled by automation, state that maintainers apply them
   manually.
3. Route questions, feature requests, bug reports, and showcase feedback to
   existing issue forms. Do not document a support forum unless one exists.
4. Keep contribution guidance aligned with generated-output rules and
   public-safe boundaries.

Acceptance criteria:

- A first-time contributor can choose a small task and the right validation
  command.
- Docs do not overstate stars, forks, contributors, portal readiness, or
  ecosystem maturity.
- Issue templates and contribution docs remain consistent.

Validation:

```bash
node scripts/validate-docs.mjs
git diff --check
```

### DR7: README Information-Density Pass

Objective: make the first five minutes clearer while preserving positioning
and exact inventory facts.

Primary files:

- `README.md`
- `nova-plugin/docs/overview/README.en.md`
- `docs/getting-started.md`

Execution steps:

1. Keep the first screen focused on project identity, target users, the
   five-command workflow, and shortest install path.
2. Move advanced details to existing sections or linked docs: agents, packs,
   Codex loop prerequisites, maintainer validation, marketplace metadata, and
   release metadata.
3. Preserve a clear note for non-Claude users: command and skill Markdown can
   be consumed as contracts, but Claude slash-command runtime behavior is not
   assumed outside Claude Code.
4. Keep inventory counts, version references, and public portal boundaries
   consistent with validators.

Acceptance criteria:

- README still passes all positioning and inventory validators.
- New users can find getting-started, five-command path, and non-Claude notes
  quickly.
- No generated files change.

Validation:

```bash
node scripts/validate-docs.mjs
git diff --check
```

### DR8: Final Review And Release Readiness

Objective: close selected work packages with traceable evidence and no hidden
skips.

Steps:

1. Review the complete diff by package, not only as one aggregate patch.
2. Run focused gates for each changed layer.
3. Run the maintainer gate.

   ```bash
   npm run validate:maintainer
   git diff --check
   ```

4. Confirm generated outputs are clean.

   ```bash
   node scripts/generate-registry.mjs
   node scripts/generate-surface-inventory.mjs
   ```

5. Confirm install smoke boundary.

   ```bash
   node scripts/validate-plugin-install.mjs --dry-run
   ```

6. If release-facing, wait for CI evidence for Linux, Windows Node, Windows
   Bash, macOS, CodeQL, dependency review, plugin install smoke, and release
   exact-tag checks as applicable.
7. Record residual risks, including skipped local Bash gates, coverage
   collection mode, hook enforcement limits, or unavailable live evidence.

Acceptance criteria:

- No stale report-derived claim contradicts live source.
- All public docs preserve project positioning.
- `.codex/`, `.metrics/`, coverage output, and local artifacts are untracked.
- Final handoff separates verified facts from deferred owner or CI evidence.

### Remaining Follow-Up Sequence

1. Continue DR1 validator modularization in small rule-family batches.
2. Keep the completed DR2 coverage baseline at 85% lines, 60% branches, and 90%
   functions; raise it only with observed supported-runtime evidence.
3. Continue DR3 by deciding whether hooks stay Bash-active or switch to Node;
   do not update `hooks.json` until docs, validators, and semver review agree.
4. Use DR4 demo fixtures as public-safe examples, not as model-output quality
   proof.
5. Keep DR5 evidence bound to checksums, build/runtime BOMs, build record,
   GitHub attestations, and reproducibility evidence.
6. Continue DR6 and DR7 as positioning-preserving documentation refinements.
7. Run DR8 final review and prepare release or promotion evidence only after CI
   confirms required gates.

Recommended branch names:

- `feature/deep-research-plan`
- `feature/validator-modules`
- `feature/coverage-timing-evidence`
- `feature/hook-portability`
- `feature/headless-demo-harness`
- `feature/release-proof-artifacts`
- `feature/contributor-onboarding`

### Subagent Execution Model

Use subagents only for bounded work with non-overlapping write sets.

Good subagent tasks:

- Read-only rule-family mapping for `validate-docs`.
- Coverage and CI artifact implementation when no other worker edits CI.
- Demo fixture and deterministic script implementation.
- Docs-only contribution-flow rewrite.
- Independent verification of release workflow permissions and artifact paths.

Avoid:

- Multiple workers editing `scripts/validate-docs.mjs` at the same time.
- A worker changing hooks while another changes hook validators without a shared
  interface contract.
- Delegating final integration review.
- Letting subagents commit `.codex/`, `.metrics/`, coverage, logs, or local
  runtime files.

Each subagent handoff should include owned files, explicit non-owned files,
validation commands, expected output artifacts, and residual risk format.

### Open Decisions

| Decision | Default | When to change |
| --- | --- | --- |
| Coverage implementation | Node built-in coverage script | Change only after supply-chain review; Ajv remains development-only for schema validation |
| Coverage gate mode | Enforce the recorded global baseline | Add per-module and mutation gates after a supported-runtime baseline |
| Active hook runtime | Bash fail-closed PreToolUse launcher and exec-form Node post-use hooks | Change only with docs, validators, and semver review |
| Release evidence | Checksums, build/runtime BOMs, build record, and GitHub attestations | Promote only identical candidate artifacts after full rehearsal |
| Community channels | Existing issues and PRs | Add Discussions only if maintainers commit to monitoring it |
| README rewrite depth | Reorder and compress only | Larger positioning rewrite only with validator updates |

## Current Baseline

- `nova-plugin` is the only production plugin. Multi-plugin behavior is covered
  by registry fixtures, not by production plugin directories.
- Exact `v4.0.0` is the current stable promotion baseline. Moving `main` may
  contain later unreleased maintenance work and must not be promoted as stable
  release content.
- README already presents the main workflow path:
  `/nova-plugin:explore` -> `/nova-plugin:produce-plan` -> `/nova-plugin:review` -> `/nova-plugin:implement-plan` ->
  `/nova-plugin:finalize-work`.
- Existing validation covers schemas, generated registry output drift, registry
  fixtures, Claude compatibility, command/skill frontmatter, active agents,
  retired active-agent surface guards, packs, pack documentation-only
  enhanced/fallback boundaries, hooks configuration, runtime smoke,
  distribution risk scanning, regression checks for key validation contracts,
  documentation links, version references, current minor support range, stale
  active planning labels, prompt surface budgets, active documentation
  inventory counts, GitHub workflow permission, inventory, and required-check
  contracts, project positioning contracts, exact-tag release promotion
  boundaries, maintainer diagnostic and
  security setting semantics, public API compatibility contracts, marketplace
  trust, author workflow, compatibility, and security review contracts,
  contribution and issue intake contracts, docs index navigation contracts,
  consumer profile privacy contracts, prompt template privacy contracts,
  local data handling privacy contracts, workflow evidence contracts, showcase
  public-safety contracts, growth metrics privacy contracts, assets capture
  privacy contracts, deferred portal IA contracts, and multi-plugin readiness evidence
  contracts.
- On Windows without Bash, `node scripts/validate-all.mjs` may report
  skipped Bash-dependent checks for local hook shell syntax and runtime smoke.
  CI/Linux and CI/Windows Bash smoke must still run the Bash gates before
  release or promotion.

## Optimization Tracks

### 1. Product Positioning And Promotion Language

Status: completed in current unreleased work

Why: Current public language is mostly aligned, but the plugin manifest and
promotion copy can still sound broader than the actual product.

Existing Coverage:

- README states that marketplace is the distribution mechanism and that the
  repository is not a mature multi-plugin ecosystem.
- Roadmap and multi-plugin readiness evidence keep public portal and multi-plugin
  migration deferred.

Completed Work:

- Revised the plugin description to emphasize workflow framework, Claude Code
  compatible commands/skills, consumer profile templates, and validation gates.
- Kept README, generated catalog, marketplace metadata, release notes, and
  promotion copy aligned with one production plugin.
- Added a short "who should use this" and "not ready for" statement to the main
  user-facing overview.

Acceptance Criteria:

- No active document claims a mature multi-plugin ecosystem or public portal.
- Generated marketplace outputs are refreshed after metadata edits.
- `node scripts/validate-schemas.mjs`,
  `node scripts/validate-claude-compat.mjs`, and
  `node scripts/validate-docs.mjs` pass.

### 2. First-Use Command Path

Status: completed in current unreleased work

Why: New users currently see many commands, skills, agents, packs, and Codex
options before they know the default path.

Existing Coverage:

- README already lists the five recommended primary commands.
- Command docs and handbooks already document advanced and compatibility
  commands.

Completed Work:

- Kept the five-command path prominent in README and strengthened it in the
  command handbook.
- Added a compact decision table mapping user intent to command:
  understand, plan, review, implement, finalize.
- Labeled compatibility and Codex commands as advanced paths in onboarding.
- Put Codex CLI and Bash prerequisites next to Codex command examples, not only
  in the compatibility matrix.

Acceptance Criteria:

- A first-time user can choose the correct primary command from README without
  reading agent or pack internals.
- Advanced commands remain available but no longer compete with primary
  onboarding.
- `node scripts/validate-docs.mjs` passes.

### 3. Workflow Reliability Examples And Review Rubrics

Status: completed in current unreleased work

Why: Structural validation proves repository contracts, but it does not prove
that LLM-generated explore, plan, review, implement, and finalize outputs are
useful on realistic tasks.

Existing Coverage:

- Redacted examples and consumer profile templates already define public-safe
  sample material.
- Command and skill contracts already define read/write boundaries.
- Release evidence now points to a concrete workflow evaluation record template
  for manual runs before minor releases.

Completed Work:

- Added a public-safe workflow evaluation set under `docs/examples/`.
- Added `docs/examples/workflow-evaluation-record-template.md` so maintainers
  can record the five-command manual run without relying on exact text
  snapshots.
- Covered the five primary commands with realistic but fictional tasks.
- Defined output rubrics instead of exact text snapshots: facts versus
  assumptions, risk prioritization, honest validation reporting, and read-only
  command boundaries.
- Added a known-limits note stating that contract checks do not prove model
  reasoning quality.

Acceptance Criteria:

- Maintainers can manually run the five-command path against documented
  examples.
- Each example states good output signals and failure signals.
- No private consumer names, paths, endpoints, credentials, or workflow details
  enter public docs.

### 4. Fact Drift Validation

Status: completed in current unreleased work

Why: Counts, versions, release state, and validation rules are repeated across
README, AGENTS, CLAUDE, roadmap, changelog, generated catalog, and command
docs.

Existing Coverage:

- `validate-docs` checks active links, command doc coverage, version
  references, current minor support range, stale active planning labels, active
  documentation inventory counts, project positioning contracts, exact-tag
  release promotion boundaries, maintainer diagnostic and security setting
  semantics, public API compatibility contracts, marketplace trust, author
  workflow, compatibility, and security review contracts, contribution and
  issue intake contracts, docs index navigation contracts, consumer profile
  privacy contracts, prompt template privacy contracts, local data handling
  privacy contracts, workflow evidence contracts, showcase public-safety
  contracts, growth metrics privacy contracts, assets capture privacy
  contracts, deferred portal IA contracts, and multi-plugin readiness evidence contracts.
- `validate-github-workflows` checks GitHub workflow token scope, workflow file
  inventory, required-check docs and print output, forbids `pull_request_target`,
  keeps release write permission scoped to the release job, and keeps mutating
  plugin install smoke isolated from default PR/push checks.
- `validate-schemas` checks generated registry outputs for drift.
- `lint-frontmatter`, `verify-agents`, and `validate-packs` already validate
  several structural counts and pack enhanced/fallback routing boundaries.

Completed Work:

- Added documentation-facing checks for command count, skill count, active agent
  count, and pack count where those facts appear in active docs.
- Added a release precheck for exact tag state:
  `git describe --tags --exact-match HEAD`.
- Kept validation as the primary mechanism over generated Markdown fragments
  until repeated manual edits become a proven maintenance cost.

Acceptance Criteria:

- `node scripts/validate-all.mjs` catches count or version drift before review.
- Release notes distinguish exact release tag content from unreleased `main`
  content.
- Generated outputs continue to be updated only from their source files.

### 5. Environment And Release Evidence

Status: completed in current unreleased work

Why: Local validation can pass with skipped Bash-dependent checks on Windows,
and that status is easy to misreport.

Existing Coverage:

- `validate-all` reports skipped Bash-dependent checks when Bash is unavailable
  on Windows.
- Release hygiene states that skipped local hook syntax and runtime smoke checks
  must not be described as locally passed.
- CI/release workflows run Bash syntax and runtime smoke checks.

Completed Work:

- Added a structured environment summary to `validate-all`.
- Added a release evidence template for validation status and skipped checks.
- Reported Node.js, Claude CLI, Bash, Codex CLI, commit, and tag state in
  validation output; skipped count remains in the validation summary.
- Kept Bash as the authoritative hook syntax runtime; did not add a PowerShell
  substitute unless the hook runtime changes.
- Added Windows CI smoke lanes for schema/docs/frontmatter/PowerShell agent
  verification and for Bash hook/runtime smoke evidence.

Acceptance Criteria:

- Release evidence cannot confuse skipped Bash-dependent checks with a full
  local pass.
- CI/Linux and CI/Windows Bash smoke remain authoritative Bash syntax and
  runtime smoke gates.
- Operators can tell whether they validated an exact tag or unreleased `main`.

### 6. Retired Archive Cleanup

Status: completed in current unreleased work

Why: Retired `.claude` agent files and intermediate archive measurement records
added maintenance noise while active agents are already fixed under
`nova-plugin/agents/`.

Existing Coverage:

- Active agents are fixed under `nova-plugin/agents/`.
- Routing docs point to the current 6-core-agent model and capability packs.
- `AGENTS.md` and `CLAUDE.md` state that retired `.claude/agents/` paths are
  not active agent locations.

Completed Work:

- Removed retired `.claude/agents/` archive documents from the current
  deliverable tree.
- Removed intermediate archive measurement records from `docs/agents/`.
- Updated active indexes so they only describe current routing documents.

Acceptance Criteria:

- Active agent set remains exactly six files under `nova-plugin/agents/`.
- Retired `.claude/agents/` paths are not recreated as active surfaces.
- No active documentation points to removed archive measurement files.

### 7. Reliability Guardrail Hardening

Status: completed in current unreleased work

Maintenance note: [workflows/gsd-informed-hardening.md](../../guides/workflows/hardening.md)

Why: Recent workflow reviews identified reliability controls that fit
`nova-plugin`: compact routing, durable checkpoints, prompt-surface budgets,
and explicit release evidence. Nova should adopt those controls while preserving
its marketplace-oriented, low-default-permission model.

Completed Work:

- Strengthened `/nova-plugin:route` as the read-only first-stage router.
- Added a checkpoint artifact contract for private consumer workbenches.
- Added `node scripts/validate-surface-budget.mjs` as a prompt bloat guard.
- Added Windows Node/PowerShell and Bash CI smoke evidence.
- Expanded distribution risk scanning for high-risk blanket permission advice
  and tracked `.codex/` runtime artifacts.

Acceptance Criteria:

- The historical command count remained 21 and command/skill one-to-one mapping
  was intact at the time; 4.0 supersedes it with six canonical skills.
- No public doc recommends blanket permission bypasses as the default path.
- Surface budget validation is wired into `validate-all`, CI, npm shortcuts,
  and release evidence.

### 8. Maintainer Diagnostics And Workflow Check Repeatability

Status: completed in current unreleased work

Why: The project had strong documentation, but maintainers still needed a
single diagnostic entry, a maintainer-level gate including whitespace checks,
and a repeatable fixture contract for workflow-quality evidence.

Completed Work:

- Added `npm run doctor` for read-only environment, version, tag, working-tree,
  and generated registry diagnostics.
- Added `npm run validate:maintainer` for default validation, generated
  registry drift, and `git diff --check`.
- Added `npm run validate:workflow` for public-safe workflow fixture integrity.
- Added `npm run validate:github-workflows` for least-privilege GitHub Actions
  workflow contracts.
- Made plugin install smoke require explicit user-scope mutation confirmation.
- Documented source-controlled workflow checks as a design boundary instead of
  adding a new runtime prematurely.

Acceptance Criteria:

- Maintainers can diagnose snapshot readiness without mutating repository or
  user plugin state.
- Release evidence distinguishes fixture contract validation from manual
  slash-command quality evaluation.
- Source-controlled check work stays public-safe and script-backed before any
  future `.nova/checks` surface is introduced.

## Execution Order

1. Positioning and promotion language.
2. First-use command path.
3. Workflow reliability examples and review rubrics.
4. Fact drift validation.
5. Environment and release evidence.
6. Retired archive cleanup and active-agent surface protection.
7. Reliability guardrail hardening.
8. Maintainer diagnostics and workflow check repeatability.

Do not start public portal work, production multi-plugin directory migration, or
large domain command families as part of these tracks.

## Release Gate

A release or promotion pass is stable only when all of these are true:

- The promoted target is an exact release tag, not a moving branch.
- Plugin version, registry source, generated marketplace files, generated
  catalog, README badge, changelog, and release date are synchronized.
- `node scripts/validate-all.mjs` passes.
- If local Windows validation reports skipped Bash-dependent checks, CI/Linux
  release validation shows hook shell syntax and runtime smoke checks passed.
- `git diff --check` passes.
- Active docs keep released versions separate from deferred public portal and
  production multi-plugin product lanes.
- README still describes one production plugin.

Release level guidance:

- Patch: wording, docs, and validation clarification only.
- Minor: new workflow examples, review rubrics, onboarding artifacts, or catalog
  health summaries.
- Major: command deletion/rename, active agent surface changes, install path
  changes, or real multi-plugin directory migration.

## Validation

For broad changes:

```bash
node scripts/generate-registry.mjs --write
node scripts/validate-all.mjs
node scripts/validate-github-workflows.mjs
node scripts/validate-runtime-smoke.mjs
node scripts/scan-distribution-risk.mjs
node scripts/validate-regression.mjs
node scripts/validate-workflow-fixtures.mjs
git diff --check
```

For documentation-only changes:

```bash
node scripts/validate-docs.mjs
git diff --check
```

When Bash is available:

```bash
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

If Bash is unavailable on Windows and `validate-all` reports skipped
Bash-dependent checks, record that limitation explicitly and rely on CI/Linux
for the hook syntax and runtime smoke gates.

</details>

<!-- merged-from: docs/marketplace/v3-readiness-evidence.md -->
<details>
<summary>Migrated source: docs/marketplace/v3-readiness-evidence.md</summary>

# Renamed: Production Multi-Plugin Readiness

Status: retired redirect

The former version-named readiness ledger has moved to
[multi-plugin-readiness.md](multi-plugin-readiness.md). Product-lane decisions
are no longer named after released plugin versions.

</details>

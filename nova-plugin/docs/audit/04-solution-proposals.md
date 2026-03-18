# 第四章：优化/进化方案

> **📦 历史决策记录（2026-03-18）**
> 本章记录了审计时提出的四套方案（A/B/C/D），已于审计当日完成选型和执行。
> 实际执行结果：方案 A + D1/D2 + B（部分）+ C（部分）全部完成。
> 当前项目状态请参考 [02-status-assessment.md](./02-status-assessment.md)。

本章提供四套完整的可执行方案。每套方案均可独立阅读，无需参考其他方案。

---

## 方案 A：低风险渐进治理

### 核心思路

在不改动任何架构的前提下，补足最明显的三类空白：文档债务（README 版本号、CHANGELOG）、测试覆盖（核心 utils 纯函数）、自动化质量门控（CI pipeline）。这是"先止血"策略，每一步都完全可回滚，零架构影响。

### 适用前提
- 项目负责人短期内没有大规模重构的时间窗口
- 需要先建立基本工程基础，再启动后续更复杂的改动
- 希望以最小成本快速提升工程成熟度

### 主要改造点

**A-1：修复 README 版本号**（15分钟）
- 文件：`README.md`
- 修改：第9行 `version-1.0.0-blue` → `version-1.0.6-blue`
- 验证：目视徽章显示正确

**A-2：创建 CI pipeline**（2小时）
- 文件：新增 `.github/workflows/ci.yml`
- 内容：三个 job
  ```yaml
  jobs:
    lint:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: '20' }
        - run: cd nova-plugin-command-generator && npm ci
        - run: cd nova-plugin-command-generator && npm run lint

    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: '20' }
        - run: cd nova-plugin-command-generator && npm ci
        - run: cd nova-plugin-command-generator && npm run test

    verify-agents:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - run: bash scripts/verify-agents.sh
  ```
- 触发条件：`push to main` 和 `pull_request`
- 验证：提交后 PR 页面出现绿色 CI 徽章

**A-3：补充核心 utils 测试**（4-8小时）
- 新增 `nova-plugin-command-generator/tests/render.test.ts`
  - 测试 `renderTemplate` 的8种边界场景：正常替换、缺失变量（`<<MISSING:key>>`）、列表变量（换行分隔）、空字符串值、多次使用同一变量、嵌套双花括号（无嵌套支持时的降级行为）
- 新增 `tests/promptQuality.test.ts`
  - 测试 `evaluateIntent`：空输入、正常输入、长输入的分值
  - 测试 `evaluateContext`：上下文是否足够的判断逻辑
  - 测试 `evaluateConstraints`：约束强度枚举的正确映射
- 新增 `tests/storage.test.ts`
  - 参考 `guidance.test.ts` 的 `createMemoryStorage` 模式
  - 测试 `loadFromStorage`：空存储、正常读取、格式错误时的降级
  - 测试 `saveToStorage`：正常写入、覆盖写入

**A-4：创建 CHANGELOG**（1小时）
- 文件：新增 `CHANGELOG.md`（仓库根目录）
- 格式：Keep a Changelog 规范（https://keepachangelog.com/）
- 初始内容：从 `git log` 整理近6个版本（v1.0.0 → v1.0.6）
  ```markdown
  ## [1.0.6] - 2026-02-12
  ### Added
  - 新增 17 个 Skills（与命令 1:1 对应）

  ## [1.0.5] - ...
  ...
  ```

### 实施步骤

1. **Day 1 上午**：A-1（15分钟）+ A-4（1小时）
2. **Day 1 下午**：A-2（2小时，含测试 CI 是否正常触发）
3. **Day 2**：A-3（4-8小时，分三个测试文件逐步推进）

### 优点
- 零架构风险，完全可回滚
- 每步独立验证，不依赖其他步骤
- 提升工程信心，为后续重构建立安全网
- CI pipeline 一次建立，永久受益

### 缺点
- 不解决 P0 级结构性问题（App.tsx 和 manifest.ts 双轨）
- 测试覆盖率提升有限（utils 纯函数覆盖后约 40%，组件层仍为零）
- 无法解决 hooks 系统空置问题

### 风险
极低。所有改动都是新增文件（tests/、workflows/）或单行修改（README），不涉及任何现有代码逻辑变更。

### 实施成本
**1-2天**，无需专项技能，任何了解项目的开发者均可执行。

### 适合的演进目标
作为所有其他方案的前置步骤。不论最终选择 B/C/D 哪套方案，A 都应先完成。

---

## 方案 B：模块化重构 + 能力演进

### 核心思路

在方案 A 的工程基础之上（以测试作为安全网），解决两个核心结构问题：继续拆分 App.tsx（完成上次重构未竟的工作）、实现 hooks 系统的基础功能，并通过文档说明双轨设计的合理性。这是"建立工程基础"策略。

### 适用前提
- 方案 A 已完成（测试覆盖为重构提供安全网）
- 开发者有1-2周的时间投入
- 有意维护 React UI 作为长期工具

### 主要改造点

**B-1：继续拆分 App.tsx**

目标：将 App.tsx 从 1690 行降至 400 行以内。

现有部分重构成果（已完成，可直接基于）：
- `src/features/generator/GeneratorPanel.tsx`（362行）— 已提取
- `src/features/workflow/WorkflowRunPanel.tsx`（483行）— 已提取
- `src/features/history/HistoryPanel.tsx`（150行）— 已提取

需要继续提取的部分：

1. **ScenesPanel.tsx**（提取 `tab === 'scenes'` 分支）
   - 场景列表渲染逻辑
   - 场景选择回调（选中后跳转到 commands tab）
   - 目标路径：`src/features/scenes/ScenesPanel.tsx`

2. **CommandsPanel.tsx**（提取 `tab === 'commands'` 分支）
   - 命令列表按阶段分组渲染
   - 命令搜索/筛选逻辑（如有）
   - 目标路径：`src/features/commands/CommandsPanel.tsx`

3. **状态下移**
   - `attachments`、`attachmentTarget` state → 移入 `GeneratorPanel`（唯一消费者）
   - `qualityFeedback` state → 移入 `GeneratorPanel`
   - 减少 App.tsx 的 props drilling 链条

4. **App.tsx 最终职责**（< 400行）：
   - Tab 路由状态（`activeTab`）
   - 全局 command 选择状态（跨 tab 共享）
   - Guidance 集成
   - 各 Panel 的懒加载包装

**B-2：实现 hooks 系统**

在 `nova-plugin/hooks/hooks.json` 中实现2个有实际价值的 hook：

1. **PreToolUse 门控 hook**（防止无计划的实现操作）
   ```json
   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Write|Edit|MultiEdit",
           "hooks": [
             {
               "type": "command",
               "command": "echo 'PLAN_APPROVED check: ensure PLAN_APPROVED=true for implement commands'"
             }
           ]
         }
       ]
     }
   }
   ```
   注意：需要参考 Claude Code 最新 hooks 格式规范确认实际字段名和结构。

2. **Stop 通知 hook**（任务结束时简短汇总）
   - 当 Claude Code 会话结束时，触发一个轻量化通知

**B-3：文档化 command/skill 双轨设计**

新增 `nova-plugin/docs/dual-track-design.md`，内容：
- Commands 的用途：重量级直接调用入口，完整 prompt 上下文，用户通过 `/command` 触发
- Skills 的用途：轻量级模块化单元，结构化元数据（YAML frontmatter），供 orchestrator 和工作流调用
- 两者的关系：互补而非重复，Claude Code 在不同场景下选择不同入口
- 维护规范：新增能力时，两者都需要更新；参数修改时，skills 的 allowed-tools 和 destructive-actions 字段需同步

### 实施步骤

**Week 1：**
- Day 1-2：B-2 hooks 实现（先研究 Claude Code hooks 规范，再填充 hooks.json）
- Day 3-4：B-3 文档（dual-track-design.md）
- Day 5：B-1 准备（阅读 App.tsx，标记提取边界）

**Week 2：**
- Day 1-3：B-1 拆分 App.tsx（先 ScenesPanel，再 CommandsPanel，最后状态下移）
- Day 4：补充拆分后的组件测试（至少确保现有测试全绿）
- Day 5：集成测试（手动验证 UI 功能完整）

### 优点
- 解决 P0-01（App.tsx 过重）
- 落地 hooks 安全增强（P1-03）
- 文档化设计意图，降低维护认知成本
- 为后续 D2（单一数据源构建脚本）做好组件边界准备

### 缺点
- 不解决 P0-02（manifest.ts 双轨问题，需 D2 配合）
- hooks 实现依赖 Claude Code hooks 规范的准确理解
- App.tsx 重构有一定风险（需测试保护）

### 风险
中等。App.tsx 重构是本方案最大风险点，必须以方案 A 的测试覆盖为前提。hooks 实现错误可能导致工具调用行为异常，需在测试环境充分验证。

### 实施成本
**1-2周**（App.tsx 重构约3-5天，hooks 约2天，文档约1天）。

### 适合的演进目标
提升工程可维护性，为未来新功能开发（如 P2-02 多插件支持）提供稳定基础。

---

## 方案 C：平台化升级

### 核心思路

将 marketplace 架构真正发挥作用：支持多插件注册、引入 JSON Schema 验证、建立完整的发布自动化流程。这是"做生态"策略，适合有明确多插件扩展规划的场景。

### 适用前提
- 方案 A 已完成（CI pipeline 已建立）
- 有明确的"第二个插件"计划或社区贡献意图
- 有时间投入基础设施建设（3-4周）

### 主要改造点

**C-1：JSON Schema 验证**

创建 `schemas/` 目录，包含：
- `schemas/plugin.schema.json`：约束 plugin.json 字段（name/description/version[semver]/author 必填；tags/categories/homepage/repository 可选）
- `schemas/marketplace.schema.json`：约束 marketplace.json 字段（plugins 数组，每项引用 plugin.schema.json）
- `schemas/hooks.schema.json`：约束 hooks.json 格式

在 CI pipeline 中增加 schema 验证 job：
```yaml
validate-schemas:
  steps:
    - run: npm install -g ajv-cli
    - run: ajv validate -s schemas/plugin.schema.json -d nova-plugin/.claude-plugin/plugin.json
    - run: ajv validate -s schemas/marketplace.schema.json -d .claude-plugin/marketplace.json
```

**C-2：marketplace 多插件支持**

为 marketplace 定义清晰的插件接入规范（`CONTRIBUTING.md` 或 `nova-plugin/docs/marketplace-plugin-guide.md`）：
- 目录结构要求（必须有 `.claude-plugin/plugin.json`）
- plugin.json 必填字段说明
- 接入流程（Fork → PR → 审核 → 合并）
- 质量评分标准（文档完整性、命令五阶段覆盖度、hooks 实现情况）

可将 `.codex/skills/ui-ux-pro-max/` 改造为第二个 plugin，作为流程验证。

**C-3：自动化发布流程**

创建 `.github/workflows/release.yml`：
- 触发条件：推送 `v*` tag（如 `v1.0.7`）
- Job：
  1. 验证 plugin.json 版本号与 tag 一致
  2. 运行完整 CI（lint + test + verify-agents + schema 验证）
  3. 自动更新 CHANGELOG（使用 `git-cliff` 或手动）
  4. 创建 GitHub Release，附带 plugin.json 描述作为 release notes

创建 `.github/workflows/version-check.yml`：
- 触发条件：PR
- 检查：如果 `nova-plugin/commands/` 或 `nova-plugin/agents/` 有改动，必须确保 `plugin.json` 的 version 也有递增
- 否则在 PR 中自动评论提醒

**C-4：Plugin 质量评分卡（可选）**

在 marketplace 层维护各插件的评分表，评分维度：
| 维度 | 满分 | 说明 |
|------|------|------|
| 文档完整性 | 30 | README、命令文档、双语支持 |
| 五阶段覆盖 | 25 | explore/plan/review/implement/finalize |
| Agent 配置质量 | 20 | 权限最小化、职责清晰 |
| 工程化成熟度 | 15 | 有测试、有 CI、有 CHANGELOG |
| hooks 实现 | 10 | 有实际 hook 配置 |

### 实施步骤

**Phase 1（Week 1-2）**：C-1（schema 验证）+ 接入规范文档
**Phase 2（Week 3）**：C-2（第二个 plugin 接入流程验证）
**Phase 3（Week 4）**：C-3（发布自动化）+ C-4（质量评分卡，可选）

### 优点
- 建立完整的插件生态基础设施
- schema 验证防止配置错误
- 自动化发布减少人工操作失误
- 质量评分卡提升插件标准化程度

### 缺点
- 实施周期长（3-4周）
- 依赖外部工具（ajv-cli、可能需要 GitHub Token 权限）
- 当前只有1个插件时，ROI 偏低
- 发布自动化配置错误可能影响正常发布

### 风险
中等。schema 验证如果配置有误会导致 CI 误报；发布自动化需要仔细测试；多插件接入流程需要人工审核机制配合。

### 实施成本
**3-4周**，需要 DevOps 经验（GitHub Actions 配置）和对 JSON Schema 的了解。

### 适合的演进目标
项目明确定位为"面向多插件的生态平台"，有吸引社区贡献的意愿和计划。

---

## 方案 D：React UI 定位重塑（专项）

### 核心思路

专门解决 `nova-plugin-command-generator` 的定位模糊问题和 manifest.ts 双轨问题。这是针对 P0-02 和 P2-03 的专项方案，可与方案 A/B/C 独立并行执行，也可作为方案 B 的前置步骤。

方案 D 分三个子方案，实施成本递增：

---

### 方案 D1：文档化定位（轻量，0.5天）

**问题解决**：P2-03（React UI 定位模糊）

**具体内容**：
- 新增 `nova-plugin/docs/command-generator-usage.md`，内容：
  - 明确定位：这是一个**离线命令构建助手**，帮助用户以可视化方式配置 nova-plugin 命令参数，然后将生成的命令文本粘贴到 Claude Code 使用
  - 使用流程：`cd nova-plugin-command-generator && npm run dev` → 访问 localhost:5173 → 选择命令 → 填写参数 → 复制输出 → 粘贴到 Claude Code
  - 与 nova-plugin 的关系：nova-plugin 是 Claude Code 的插件（实际功能所在），command-generator 是辅助工具（降低使用门槛）
  - 未来可能的部署方式：GitHub Pages

**适用场景**：最低成本解决用户困惑，不涉及任何代码改动。

---

### 方案 D2：单一数据源构建脚本（中量，2-3天）

**问题解决**：P0-02（manifest.ts 双轨维护）

**核心设计**：`nova-plugin/commands/*.md` 成为**唯一数据源**，manifest.ts 由构建脚本自动生成，不再手动维护。

**实施步骤**：

1. **约定 commands/*.md 的 frontmatter 格式规范**

   在每个 commands/*.md 文件头部增加结构化 YAML frontmatter：
   ```yaml
   ---
   id: senior-explore
   stage: explore
   title: Senior Explore
   description: "深度探索..."
   destructive-actions: low
   fields:
     - id: TARGET
       type: text
       label: "目标文件/目录"
       required: true
   outputs:
     - id: ANALYSIS_REPORT
       description: "分析报告"
   ---
   ```

2. **编写 Node.js 构建脚本**（约 150 行）

   路径：`nova-plugin-command-generator/scripts/build-manifest.mjs`

   功能：
   - 读取 `nova-plugin/commands/*.md` 的所有文件
   - 解析每个文件的 YAML frontmatter（使用 `gray-matter` 库）
   - 生成符合 `src/types.ts` 中 `Manifest` 类型的 TypeScript 对象
   - 写出到 `src/data/manifest.ts`（含 "// AUTO-GENERATED" 注释）

   注意：`scenarios` 和 `workflows` 数据是 UI 专属的（不在 commands/*.md 中），这部分保留在 `src/data/scenarios.ts` 和 `src/data/workflows.ts` 中手动维护。

3. **更新 package.json**

   ```json
   "scripts": {
     "build:manifest": "node scripts/build-manifest.mjs",
     "dev": "node scripts/build-manifest.mjs && vite",
     "build": "node scripts/build-manifest.mjs && tsc && vite build"
   }
   ```

4. **将 manifest.ts 移出手动维护**
   - 在 `src/data/manifest.ts` 文件头添加注释：`// AUTO-GENERATED by scripts/build-manifest.mjs - do not edit manually`
   - 可选：将 manifest.ts 加入 `.gitignore`（纯生成产物）或保留在版本控制中（便于 review 变更）

**验证方式**：运行 `npm run build:manifest`，对比生成的 manifest.ts 与当前手动维护版本，确保数据一致。

**优点**：彻底消除 P0-02 风险，commands/ 成为单一真实数据源；修改命令定义后无需同步两处。

**缺点**：需要在 commands/*.md 中增加 frontmatter（额外维护负担，但集中在一处）；需要引入 `gray-matter` 依赖；现有 manifest.ts 中的纯 UI 数据（scenarios/workflows）需要分离。

---

### 方案 D3：MCP Server 重构（重量，独立项目级，长期）

**核心思路**：将 nova-plugin-command-generator 改造为一个 MCP（Model Context Protocol）Server，使 Claude Code 可以直接调用命令构建能力，而不需要用户手动复制粘贴。

**这意味着**：用户在 Claude Code 中说"帮我用 senior-explore 命令分析这个文件"，Claude Code 通过 MCP Server 获取命令模板、填充参数、返回格式化后的命令提示词，直接执行——无需访问 React UI。

**实施要点**：
- 引入 `@modelcontextprotocol/sdk` 依赖
- 实现 MCP Server（Node.js），暴露 `get_command_template`、`list_commands`、`build_prompt` 三个 tool
- React UI 可以保留（作为面向人类用户的界面），但不再是唯一使用方式
- 需要用户在 Claude Code 中配置 MCP Server 连接（mcpServers 配置）

**实施成本**：独立项目级，预估 2-4 周，需要 MCP SDK 经验。

**建议**：在 D1/D2 完成后，启动 D3 的可行性研究（PoC），再决定是否全量实施。

---

## 方案总览

| 方案 | 核心价值 | 解决的问题 | 实施周期 | 可独立执行 |
|------|---------|---------|---------|----------|
| **A** | 止血 + 工程基础 | P1-01/02/04/05 | 1-2天 | ✅ 是（首先执行）|
| **B** | 模块化 + 能力演进 | P0-01（部分）、P1-03/06 | 1-2周 | 需 A 完成后 |
| **C** | 平台化生态 | P2-02/06 | 3-4周 | 需 A 完成后 |
| **D1** | UI 定位说明 | P2-03 | 0.5天 | ✅ 是（与 A 并行）|
| **D2** | 消除双轨维护 | P0-02 | 2-3天 | ✅ 是（与 A 并行）|
| **D3** | MCP Server 重构 | P2-03（根本解决）| 2-4周 | 需 D1/D2 完成后 |

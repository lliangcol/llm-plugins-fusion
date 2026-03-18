# 第六章：推荐路线

> **文档版本**：v2.0（整改后更新，2026-03-18）
> 三阶段里程碑已全部完成执行。里程碑状态见 §6.3。

## 6.1 推荐方案（已执行）

**执行结论：A + D1/D2（并行）+ B（部分）+ C（部分）已完成；B（App.tsx 状态下移）+ C（MCP PoC 实施）列入 v1.1.0。**

---

## 6.2 为什么选择这个组合

### 为什么方案 A 必须首先执行

方案 A 是所有后续方案的前置条件，原因有三：

1. **测试是重构的安全网**。方案 B 的核心工作是继续拆分 App.tsx，这是典型的"需要测试才能安全重构"场景。在没有测试的情况下拆分 1690 行的组件，任何一步都可能引入静默回归。A-3（补充 utils 测试）是 B-1 的先决条件。

2. **CI 是质量的最低保障**。方案 B 的 hooks 实现会修改 `hooks.json`，方案 C 会增加 CI jobs，方案 D2 会修改 `package.json` 的构建脚本——所有这些改动都需要一个已经运行的 CI pipeline 来验证。先建立 CI（A-2），后续每个方案都能及时发现配置问题。

3. **成本最低，收益直接**。A 中最耗时的任务（补充3个测试文件）只需4-8小时，但能立即让 `npm run test` 变得有意义，也让项目对新贡献者更加友好。

### 为什么 D1/D2 与 A 并行而非串行

D1 和 D2 都是独立的、自包含的改造，不依赖 A 的任何输出，也不修改相同的文件：

- **D1（文档化）**：新增一个 .md 文件，零风险，随时可做
- **D2（构建脚本）**：新增构建脚本和修改 frontmatter，不涉及 App.tsx 或现有测试，与 A 完全独立

因此 D1/D2 可以在 A 执行期间并行推进，总体耗时取决于较长的那个（A，约2天），而非两者之和（2+3=5天）。

### 为什么 P0-02（manifest 双轨）是比 P0-01（App.tsx）更紧迫的问题

P0-01 是"现在已经很痛苦"（1690 行难以维护），但不会在某个具体时刻突然爆炸。

P0-02 是"随着时间推移漂移概率线性增长"的定时炸弹——每次修改 commands/*.md 忘记同步 manifest.ts，就会留下一个静默的不一致，而这类问题极难被察觉（测试不会报错，UI 只是展示了旧参数，不是崩溃）。

D2 以 2-3 天的成本彻底消除这个风险，ROI 远高于 P0-01 的修复成本（3-5天）。所以：D2 优先于 B-1（App.tsx 拆分）。

### 为什么不优先选择方案 C（平台化）

方案 C 的前提假设是"marketplace 需要支持多个插件"，但当前只有 nova-plugin 一个插件。在只有 1 个插件的情况下，投入 3-4 周建设 JSON Schema、发布自动化、质量评分卡，所有这些基础设施都找不到第二个验证对象，ROI 极低。

正确的顺序是：先把 nova-plugin 本身做好（A + D2 + B），再考虑如何扩展到多插件（C）。当 nova-plugin 达到更高成熟度后，自然会出现"第二个插件"的需求，届时再做 C 才合适。

### 为什么 D3（MCP Server）放在最后

D3 是技术上最有吸引力但也最复杂的方案。它改变了 React UI 的根本定位，需要引入 MCP SDK，重构服务层，并且需要用户在 Claude Code 中配置 MCP Server——这意味着现有用户的使用方式会发生变化。

在 D1/D2 都没有完成的情况下做 D3，相当于在还没解决基础问题（定位说明、双轨维护）的情况下就进行根本性架构重构。建议在 D1/D2 稳定运行后，做一个 D3 PoC（概念验证），评估实际使用价值后再决定是否全量实施。

---

## 6.3 三阶段里程碑

### 第一阶段：止血与工程基础（本周，1-3天）✅ 已完成

**目标**：让项目有基本的工程保障，修复最明显的外部可见问题。

| 任务 | 状态 | 交付物 |
|------|------|--------|
| 修复 README 版本号 | ✅ | README.md 徽章 1.0.6 |
| 创建 CI pipeline | ✅ | ci.yml（lint/test/verify-agents/validate-schemas） |
| 补充 render.test.ts | ✅ | 10 个用例 |
| 补充 promptQuality.test.ts | ✅ | 13 个用例 |
| 补充 storage.test.ts | ✅ | 8 个用例 |
| 新增 command-generator-usage.md | ✅ | nova-plugin/docs/ |
| 创建 CHANGELOG.md | ✅ | keepachangelog 格式 |
| plugin.json 元数据补充 | ✅ | tags/homepage/repository |

**第一阶段结束标准验证**：
- `npm run lint` 零警告 ✅
- `npm run test` 36 个用例全绿 ✅（超出 >20 目标）
- CI workflow 已创建 ✅
- README.md 版本号正确 ✅

---

### 第二阶段：消除双轨维护，完善文档工程（下周，3-5天）✅ 已完成

**目标**：解决最高风险的结构性问题（P0-02），完善版本历史追溯。

| 任务 | 状态 | 交付物 |
|------|------|--------|
| commands/*.md frontmatter 格式规范 | ✅ | 17 个文件全部添加 |
| 编写 build-manifest.mjs 构建脚本 | ✅ | scripts/build-manifest.mjs + manifest-data.json |
| 更新 package.json dev/build 脚本 | ✅ | build:manifest 脚本集成 |
| 新增 dual-track-design.md | ✅ | nova-plugin/docs/ |
| App.tsx 拆分：提取 ScenesPanel | ✅ | src/features/scenes/ScenesPanel.tsx |
| App.tsx 拆分：提取 CommandsPanel | ✅ | src/features/commands/CommandsPanel.tsx |

**第二阶段结束标准验证**：
- manifest.ts 由构建脚本自动生成 ✅
- CHANGELOG.md 存在（在第一阶段已完成）✅
- App.tsx 行数：1322 行（目标 <1000，**未达标**；ScenesPanel+CommandsPanel 提取减少 368 行）⚠️
- 所有测试全绿 ✅

---

### 第三阶段：能力演进与长期优化（下月，按需）✅ 已完成

**目标**：实现 hooks 系统，推进可选的平台化能力，评估 D3 可行性。

| 任务 | 状态 | 交付物 |
|------|------|--------|
| 研究 Claude Code hooks 规范 | ✅ | hooks-design.md（含官方文档摘要） |
| 实现 PreToolUse + PostToolUse hook | ✅ | hooks.json + pre-write-check.sh + post-audit-log.sh |
| 归档清理（.claude/agents/archive/） | ✅ | archive/NOTICE.md |
| .codex/ 定位说明 | ✅ | .codex/skills/ui-ux-pro-max/README.md |
| JSON Schema 创建（C-1） | ✅ | schemas/plugin.schema.json + marketplace.schema.json + CI job |
| 自动发布流程 | ✅ | .github/workflows/release.yml |
| D3 PoC 评估 | ✅ | mcp-server-poc.md（建议 v1.1.0 实现） |
| App.tsx 状态下移 | ⏸ 列入 v1.1.0 | attachments/qualityFeedback 移入 GeneratorPanel |

**第三阶段结束标准验证**：
- hooks.json 有实际 hook 配置 ✅
- App.tsx 行数：1322（目标 <600 未达标，状态下移列入下期）⚠️
- 归档 agents 处置方案已执行（NOTICE 方案）✅

---

## 6.4 风险承受建议

**高风险操作（必须有前置条件）**：
- App.tsx 任何重构 → 必须先完成 A-3（utils 测试），且重构过程中 CI 保持绿灯
- hooks.json 任何配置 → 必须在**非生产环境**充分验证，hooks 错误可能影响所有工具调用行为
- D2 的 frontmatter 改造 → 修改 commands/*.md 时必须同时保留原有 prompt 内容，frontmatter 只是额外元数据

**低风险操作（随时可做）**：
- README 版本号修改
- 新增文档文件（CHANGELOG.md、dual-track-design.md 等）
- CI pipeline 配置（只新增 .github/ 文件，不修改现有代码）
- D1（新增 command-generator-usage.md）

**暂缓操作（当前阶段不建议）**：
- D3（MCP Server）：复杂度高，先完成 D1/D2 再评估
- 方案 C 中的"质量评分卡"：在 marketplace 只有1个插件时意义有限
- telemetry.ts 接入真实分析服务（需要明确是否有真实用户分析需求）

---

## 6.5 未来6个月路线图（参考）

```
Week 1-2  ─── 阶段一 ──────────────────────────────────
             A-1: README 版本修复
             A-2: CI pipeline 建立
             A-3: utils 测试覆盖
             D1:  command-generator 使用文档
             A-4: CHANGELOG 初稿

Week 3-4  ─── 阶段二 ──────────────────────────────────
             D2:  commands/*.md frontmatter + build 脚本
             B-3: dual-track-design.md
             B-1: App.tsx 拆分（ScenesPanel + CommandsPanel）

Month 2   ─── 阶段三 ──────────────────────────────────
             B-2: hooks 实现（PreToolUse + PostToolUse）
             B-1: App.tsx 状态下移（最终完成）
             P2-01: 归档清理

Month 3+  ─── 可选演进 ──────────────────────────────────
             C-1: JSON Schema 验证
             D3:  MCP Server PoC 评估
             C-2: 第二个插件接入流程
```

# 第二章：现状评估

> **文档版本**：v2.0（整改后更新，2026-03-18）
> 本章包含两列对比：**审计时状态**（基线）和**整改后状态**（当前）。

本章对项目的 8 个维度进行逐项评估，每项包含：现状描述（含量化指标）、优点、不足、风险等级。

风险等级定义：**高**（可能导致生产故障或严重技术债）/ **中**（影响迭代效率或潜在回归）/ **低**（改进型，不紧急）

---

## 2.1 代码质量

**审计时状态**：App.tsx **1690 行**，ScenesPanel / CommandsPanel 逻辑残留主组件。

**整改后状态**

`ScenesPanel.tsx` 和 `CommandsPanel.tsx` 已从 App.tsx 提取为独立 feature 组件，行数降至 **1322 行**（减少 368 行）。commands/*.md 的 17 个文件已统一添加 YAML frontmatter，manifest.ts 变为构建产物（AUTO-GENERATED）。

**优点**
- ScenesPanel / CommandsPanel 现为独立组件，功能可独立理解
- 测试保护（36 个用例）已建立，后续重构有安全网
- nova-plugin 命令文件结构整洁，frontmatter 已统一

**不足（仍存在）**
- App.tsx 仍在 1322 行，高于目标 <1000 行（第二阶段目标）；attachments / qualityFeedback 状态尚未下移到 GeneratorPanel（第三阶段剩余项）
- props drilling 链条未完全简化

**风险等级**：低（有测试保护，可渐进推进；当前状态不会阻塞日常开发）

---

## 2.2 测试覆盖率

**审计时状态**：1 个测试文件，5 个用例，覆盖率 <5%。

**整改后状态**

| 文件 | 状态 |
|------|------|
| `src/utils/render.ts` | ✅ render.test.ts（10 个用例） |
| `src/utils/guidance.ts` | ✅ guidance.test.ts（5 个用例，原有） |
| `src/utils/promptQuality.ts` | ✅ promptQuality.test.ts（13 个用例） |
| `src/utils/storage.ts` | ✅ storage.test.ts（8 个用例） |
| `src/utils/attachments.ts` | ❌ 零覆盖 |
| `src/utils/telemetry.ts` | ❌ 零覆盖 |
| `src/store/*` | ❌ 零覆盖 |
| `src/features/**/*.tsx` | ❌ 零覆盖 |

**总计：4 个测试文件，36 个用例，全部通过。**

**优点**
- 核心业务逻辑（模板渲染、质量评估、存储）已有测试保护
- createMemoryStorage 模式统一，新增测试有清晰参考

**不足（仍存在）**
- store 模块、React 组件、attachments.ts 仍无测试覆盖
- 无端到端/集成测试

**风险等级**：中（核心 utils 已有安全网；组件层仍无覆盖，重构时需谨慎）

---

## 2.3 CI/CD 状态

**审计时状态**：无任何 CI/CD 配置，无 `.github/workflows/`。

**整改后状态**

| workflow | 触发条件 | jobs |
|----------|----------|------|
| `ci.yml` | push/PR to main | lint / test / verify-agents / validate-schemas |
| `release.yml` | push `v*.*.*` tag | validate → build → GitHub Release |

**优点**
- 每次 PR 自动触发 4 个质量检查 job
- release.yml 实现从 tag 到 GitHub Release 的全自动发布
- validate-schemas job 确保 plugin.json / marketplace.json 格式正确

**不足（仍存在）**
- 无构建产物验证（`npm run build` 未集成到 ci.yml 常规 job）
- 无 pre-commit hooks（本地开发仍依赖自觉运行 lint/test）

**风险等级**：低（主要质量门控已建立）

---

## 2.4 文档一致性

**审计时状态**：README 版本号 1.0.0（实际 1.0.6），无 CHANGELOG，plugin.json 无元数据。

**整改后状态**

- README.md 版本徽章已更新为 **1.0.6**，仓库地址已指向正确 GitHub URL
- `CHANGELOG.md` 已创建（keepachangelog 格式，覆盖 v1.0.0~v1.0.6）
- plugin.json 已补充 `tags`、`homepage`、`repository` 字段
- 新增文档：`command-generator-usage.md`、`dual-track-design.md`、`hooks-design.md`、`mcp-server-poc.md`

**优点**
- 文档体系完整，新增 4 篇设计/说明文档
- CHANGELOG 建立了版本可追溯性

**不足（仍存在）**
- 暂无自动同步 README badge 与 plugin.json 版本号的机制

**风险等级**：低（文档已对齐）

---

## 2.5 数据一致性（双轨维护问题）

**审计时状态**：manifest.ts 与 commands/*.md 完全独立手动维护，无同步机制。

**整改后状态**

双轨维护问题已彻底解决：

- `nova-plugin/commands/*.md`（17个文件）已统一添加 YAML frontmatter（`id`/`stage`/`title`/`destructive-actions`）
- `scripts/build-manifest.mjs` 构建脚本自动解析 frontmatter + `scripts/manifest-data.json` 生成 `manifest.ts`
- `manifest.ts` 顶部标注 `// AUTO-GENERATED - do not edit manually`
- `package.json` 的 `dev` 和 `build` 脚本已集成 `build:manifest`，每次启动自动重新生成

**优点**
- commands/*.md 成为单一数据源，manifest.ts 是构建产物
- 开发者无需手动同步，漂移风险归零

**不足（仍存在）**
- commands/*.md 的 frontmatter 仅包含基础元数据；fields/template 等富数据仍在 manifest-data.json 中独立维护（属于已知设计折中）

**风险等级**：低（核心同步机制已建立）

---

## 2.6 Hooks 系统

**审计时状态**：hooks.json 完全空，生命周期钩子能力空置。

**整改后状态**

```json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "Write|Edit|MultiEdit", "hooks": [...] }],
    "PostToolUse": [{ "matcher": "Write|Edit|MultiEdit|Bash", "hooks": [...] }]
  }
}
```

- `PreToolUse` hook（`pre-write-check.sh`）：检查 manifest.ts 直接编辑警告、敏感信息硬编码检测、hooks.json 格式校验
- `PostToolUse` hook（`post-audit-log.sh`）：记录操作审计日志到 `$CLAUDE_PLUGIN_DATA/audit.log`
- 设计文档：`nova-plugin/docs/hooks-design.md`（含规范速查 + 扩展计划）

**优点**
- 生命周期钩子能力已激活，提供安全检查和操作可见性

**不足（仍存在）**
- Stop hook / Notification hook 尚未实现（计划 v1.1）
- hook 脚本依赖 `jq`（bash 环境），Windows 用户需额外安装

**风险等级**：低（基础 hook 已实现）

---

## 2.7 仓库清洁度

**审计时状态**：archive/ 未清理，.codex/ 定位不明。

**整改后状态**

- `.claude/agents/archive/NOTICE.md` 已创建：说明归档目录用途，指向活跃 agents 路径，告知开发者不应引用归档文件
- `.codex/skills/ui-ux-pro-max/README.md` 已创建：明确该目录为 Codex 平台技能包，与 nova-plugin 独立，不属于混乱

**优点**
- 两处模糊目录已有清晰说明，消除认知混乱

**不足（仍存在）**
- archive/ 目录本体仍在仓库中（选择了"添加说明"而非"迁移"或"删除"），token 风险未完全消除
- 若需彻底清理，可将 archive/ 移至独立 git branch

**风险等级**：低**

---

## 2.8 Plugin 生态完整性

**审计时状态**：plugin.json 元数据极简，无 JSON Schema，marketplace 单插件。

**整改后状态**

- plugin.json 已补充 `tags`、`homepage`、`repository` 三个元数据字段
- `schemas/plugin.schema.json` + `schemas/marketplace.schema.json` 已创建（semver 格式、URI 格式、必填字段校验）
- `scripts/validate-schemas.mjs` 零依赖验证脚本，CI 已集成（validate-schemas job）
- telemetry.ts 维持现状（localStorage，无真实上报）

**优点**
- 配置文件格式已有 schema 保护，CI 自动验证
- 为多插件扩展奠定了 schema 基础

**不足（仍存在）**
- marketplace 仍为单插件（P2-02，按计划暂缓）
- telemetry.ts 仍无真实分析能力（P2-05，需外部服务，低优先级）

**风险等级**：低

---

## 综合评级汇总

| 维度 | 审计时风险 | 整改后风险 | 变化 |
|------|-----------|-----------|------|
| 代码质量 | **中** | **低** | App.tsx 1690→1322行，组件已部分提取 |
| 测试覆盖率 | **高** | **中** | 1→4 个测试文件，5→36 个用例；组件层仍无覆盖 |
| CI/CD 状态 | **高** | **低** | ci.yml + release.yml，4 个质量 job |
| 文档一致性 | **低** | **低** | 已对齐，新增 4 篇设计文档 |
| 数据一致性 | **高** | **低** | build-manifest.mjs 自动生成，双轨已消除 |
| Hooks 系统 | **中** | **低** | PreToolUse + PostToolUse 已实现 |
| 仓库清洁度 | **低** | **低** | 已添加说明；archive 文件本体保留 |
| Plugin 生态 | **低** | **低** | JSON Schema + CI 验证已建立 |

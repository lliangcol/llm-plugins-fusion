# 第三章：问题清单

> **文档版本**：v2.0（整改后更新，2026-03-18）
> 14 条问题已全部处理（其中 P2-02 marketplace 扩展按计划暂缓）。

共 14 条问题，按优先级分为 P0（高风险，须尽快处理）、P1（重要优化项）、P2（中长期优化项）三组。

**修复难度说明**：低（<4小时）/ 中（1-3天）/ 高（1周以上）
**状态说明**：✅ 已解决 / ⏸ 暂缓（有计划）/ 🔄 部分解决

---

## P0 级问题（高风险，阻塞型）

### P0-01：App.tsx 巨型组件（1690行），场景/命令/附件/质量逻辑高度耦合

**状态：🔄 部分解决**

| 字段 | 内容 |
|------|------|
| **涉及文件** | `nova-plugin-command-generator/src/App.tsx` |
| **原始描述** | App.tsx 1690 行，场景/命令面板逻辑残留主组件，无测试保护 |
| **解决情况** | `ScenesPanel.tsx` 和 `CommandsPanel.tsx` 已提取为独立组件；App.tsx 降至 **1322 行**（减少 368 行）；36 个测试用例提供安全网 |
| **交付物** | `src/features/scenes/ScenesPanel.tsx`、`src/features/commands/CommandsPanel.tsx` |
| **剩余工作** | attachments / qualityFeedback state 尚未下移到 GeneratorPanel（最终目标 <500 行），计划 v1.1.0 |

---

### P0-02：manifest.ts 与 commands/ 双轨维护，无自动同步机制

**状态：✅ 已解决**

| 字段 | 内容 |
|------|------|
| **涉及文件** | `nova-plugin-command-generator/src/data/manifest.ts`、`nova-plugin/commands/*.md` |
| **原始描述** | manifest.ts 是 commands/*.md 的硬编码副本，完全手动维护，无同步机制 |
| **解决情况** | commands/*.md 统一添加 YAML frontmatter；build-manifest.mjs 自动生成 manifest.ts；package.json dev/build 集成 build:manifest；manifest.ts 标注 AUTO-GENERATED |
| **交付物** | `scripts/build-manifest.mjs`、`scripts/manifest-data.json`、17 个 commands/*.md frontmatter |

---

## P1 级问题（重要优化项）

### P1-01：测试覆盖极低（全项目仅1个测试文件，覆盖率 <5%）

**状态：✅ 已解决**

| 字段 | 内容 |
|------|------|
| **原始描述** | 全项目仅 guidance.test.ts，覆盖率 <5% |
| **解决情况** | 新增 render.test.ts（10用例）、promptQuality.test.ts（13用例）、storage.test.ts（8用例）；总计 4 个测试文件，36 个用例，全部通过 |
| **交付物** | `tests/render.test.ts`、`tests/promptQuality.test.ts`、`tests/storage.test.ts` |

---

### P1-02：无 CI/CD pipeline，无自动化质量门控

**状态：✅ 已解决**

| 字段 | 内容 |
|------|------|
| **原始描述** | 无任何 CI/CD，无自动质量检查 |
| **解决情况** | ci.yml 含 lint / test / verify-agents / validate-schemas 四个 job；release.yml 实现 tag 自动发布 |
| **交付物** | `.github/workflows/ci.yml`、`.github/workflows/release.yml` |

---

### P1-03：hooks 系统完全未实现，生命周期钩子能力空置

**状态：✅ 已解决**

| 字段 | 内容 |
|------|------|
| **原始描述** | hooks.json 完全空，无任何 hook 定义 |
| **解决情况** | PreToolUse（写入前检查：manifest.ts 保护/敏感信息/JSON格式）+ PostToolUse（审计日志）已实现；hooks-design.md 提供规范说明 |
| **交付物** | `nova-plugin/hooks/hooks.json`、`hooks/scripts/pre-write-check.sh`、`hooks/scripts/post-audit-log.sh`、`docs/hooks-design.md` |

---

### P1-04：README.md 版本号滞后 6 个次版本

**状态：✅ 已解决**

| 字段 | 内容 |
|------|------|
| **原始描述** | README 徽章显示 1.0.0，实际版本 1.0.6 |
| **解决情况** | README.md 版本徽章已更新为 1.0.6，仓库 URL 已指向正确 GitHub 地址 |

---

### P1-05：无 CHANGELOG，版本迭代不可追溯

**状态：✅ 已解决**

| 字段 | 内容 |
|------|------|
| **原始描述** | 无 CHANGELOG，版本迭代历史仅靠 git log |
| **解决情况** | CHANGELOG.md 已创建，keepachangelog 格式，覆盖 v1.0.0~v1.0.6 全部版本 |
| **交付物** | `CHANGELOG.md`（仓库根目录） |

---

### P1-06：commands/ 与 skills/ 1:1 重复，职责边界无文档说明

**状态：✅ 已解决**

| 字段 | 内容 |
|------|------|
| **原始描述** | commands/ 与 skills/ 双轨存在但无设计意图说明 |
| **解决情况** | dual-track-design.md 已创建，说明两者的定位差异、互补关系、新增能力时的维护规范及官方 frontmatter 字段对照表 |
| **交付物** | `nova-plugin/docs/dual-track-design.md` |

---

## P2 级问题（中长期优化项）

### P2-01：.claude/agents/archive/ 归档 agents 仍在仓库，脚本已注释 token 风险

**状态：✅ 已解决（添加说明方案）**

| 字段 | 内容 |
|------|------|
| **原始描述** | archive/ 目录 69 个文件定位不明，token 风险已知但未处理 |
| **解决情况** | `.claude/agents/archive/NOTICE.md` 已创建，说明归档目录用途、指向活跃 agents、警告不应引用归档文件 |
| **注** | 文件本体保留（选择"添加说明"方案）；如需彻底清理可迁移至独立分支 |

---

### P2-02：marketplace.json 只有1个插件，市场架构未发挥作用

**状态：⏸ 按计划暂缓**

| 字段 | 内容 |
|------|------|
| **原始描述** | marketplace 仅注册 1 个插件，多插件架构未发挥作用 |
| **处理决策** | 暂缓，等待第二个插件自然出现时再推进。当前重点是完善 nova-plugin 自身质量（已完成）。 |
| **基础设施** | schemas/marketplace.schema.json 已创建，多插件格式约束已准备好 |

---

### P2-03：nova-plugin-command-generator 与插件体系割裂，定位模糊

**状态：✅ 已解决**

| 字段 | 内容 |
|------|------|
| **原始描述** | React UI 定位不明，用户不理解其与 nova-plugin 的关系 |
| **解决情况** | command-generator-usage.md 已创建，说明工具定位、启动方式、5步使用流程、与 nova-plugin 关系表；manifest.ts 双轨问题已通过 build-manifest.mjs 根本解决 |
| **交付物** | `nova-plugin/docs/command-generator-usage.md` |

---

### P2-04：.codex/skills/ui-ux-pro-max/ 定位不明

**状态：✅ 已解决**

| 字段 | 内容 |
|------|------|
| **原始描述** | .codex/ 目录定位不明，与 nova-plugin 关系不清晰 |
| **解决情况** | `.codex/skills/ui-ux-pro-max/README.md` 已创建，明确说明该目录是 Codex 平台技能包，与 nova-plugin（Claude Code）相互独立，不属于认知混乱 |

---

### P2-05：telemetry.ts 仅落地到 localStorage，无真实分析能力

**状态：⏸ 按计划暂缓**

| 字段 | 内容 |
|------|------|
| **原始描述** | telemetry.ts 只写 localStorage，无真实用户分析能力 |
| **处理决策** | 暂缓，维持现状（localStorage 可用于开发调试）。接入真实分析服务需明确产品分析需求，当前优先级低。 |

---

### P2-06：plugin.json / marketplace.json 无 JSON Schema 验证

**状态：✅ 已解决**

| 字段 | 内容 |
|------|------|
| **原始描述** | 配置文件无 schema 约束，格式错误无法被检测 |
| **解决情况** | schemas/ 目录已创建，plugin.schema.json + marketplace.schema.json 定义完整约束（semver、URI、必填字段）；validate-schemas.mjs 零依赖脚本；CI validate-schemas job 已集成 |
| **交付物** | `schemas/plugin.schema.json`、`schemas/marketplace.schema.json`、`scripts/validate-schemas.mjs` |

---

## 问题优先级汇总（整改后）

| 优先级 | 问题 ID | 状态 | 交付物 |
|--------|---------|------|--------|
| P0 | P0-01（App.tsx 巨型组件） | 🔄 部分解决 | ScenesPanel + CommandsPanel 提取，1690→1322行 |
| P0 | P0-02（manifest.ts 双轨维护） | ✅ 已解决 | build-manifest.mjs + 17个 frontmatter |
| P1 | P1-01（测试覆盖极低） | ✅ 已解决 | 4个测试文件，36个用例 |
| P1 | P1-02（无 CI/CD） | ✅ 已解决 | ci.yml + release.yml |
| P1 | P1-03（hooks 系统空置） | ✅ 已解决 | hooks.json + 2个脚本 + hooks-design.md |
| P1 | P1-04（README 版本号过期） | ✅ 已解决 | README.md 版本 1.0.6 |
| P1 | P1-05（无 CHANGELOG） | ✅ 已解决 | CHANGELOG.md |
| P1 | P1-06（command/skill 双轨无说明） | ✅ 已解决 | dual-track-design.md |
| P2 | P2-01（归档 agents 未清理） | ✅ 已解决 | archive/NOTICE.md |
| P2 | P2-02（marketplace 单插件） | ⏸ 暂缓 | schema 基础设施已就绪 |
| P2 | P2-03（React UI 定位模糊） | ✅ 已解决 | command-generator-usage.md |
| P2 | P2-04（.codex/ 定位不明） | ✅ 已解决 | .codex/README.md |
| P2 | P2-05（telemetry 无实际价值） | ⏸ 暂缓 | 低优先级，待产品分析需求出现 |
| P2 | P2-06（无 JSON Schema） | ✅ 已解决 | schemas/ + validate-schemas.mjs + CI job |

# 第七章：可执行行动清单

> **文档版本**：v2.0（2026-03-18）— **✅ 所有条目已完成**（P2-02 marketplace扩展、P2-05 telemetry 按计划暂缓）

使用方式：将此文件内容直接复制到 GitHub Issue 或项目任务管理工具中，按阶段逐步执行。每条行动包含：优先级、预估时间、具体操作、验证方式。

---

## 第一阶段：立即执行（本周，1-3天）

### 文档与版本修复

- [x] **[P1] [15min]** 修改 `README.md` 第9行：`version-1.0.0-blue` → `version-1.0.6-blue`
  - 验证：在 GitHub 上查看 README 徽章，显示版本号 1.0.6

- [x] **[P2] [30min]** 在 `nova-plugin/.claude-plugin/plugin.json` 中增加 tags、homepage、repository 字段
  - 参考值：`"tags": ["workflow", "ai-coding", "claude-code"]`，`"repository": "https://github.com/..."` （填入实际仓库地址）
  - 验证：JSON lint 通过（`echo $?` 为0），字段存在

- [x] **[P1] [1h]** 创建 `CHANGELOG.md`（仓库根目录），从 `git log` 整理 v1.0.0 → v1.0.6 变更
  - 格式参考：https://keepachangelog.com/zh-CN/1.0.0/
  - 验证：文件存在，包含每个版本的 Added/Changed/Fixed 分组

### CI/CD 建立

- [x] **[P1] [2h]** 创建 `.github/workflows/ci.yml`，包含以下三个 job：
  - `lint`：`cd nova-plugin-command-generator && npm ci && npm run lint`
  - `test`：`cd nova-plugin-command-generator && npm ci && npm run test`
  - `verify-agents`：`bash scripts/verify-agents.sh`
  - 触发条件：`push` 到 main，`pull_request`
  - 验证：向 main 发起一个 PR，观察 Checks 页面出现三个绿色 job

### 测试覆盖补充

- [x] **[P1] [2h]** 新增 `nova-plugin-command-generator/tests/render.test.ts`，覆盖以下场景：
  - 正常变量替换（`{{KEY}}` → 对应值）
  - 缺失变量处理（应输出 `<<MISSING:KEY>>`）
  - 列表类型变量（换行分隔后的数组处理）
  - 空字符串值替换
  - 同一变量在模板中出现多次
  - 模板无变量（原样返回）
  - 验证：`npm run test` 通过，render.test.ts 中 > 6 个用例全绿

- [x] **[P1] [2h]** 新增 `tests/promptQuality.test.ts`，覆盖以下场景：
  - `evaluateIntent`：空输入分值最低，正常描述分值中等，详细描述分值高
  - `evaluateContext`：有无上下文对评分的影响
  - `evaluateConstraints`：strong/medium/weak 枚举映射正确
  - 验证：`npm run test` 通过，promptQuality.test.ts 中 > 5 个用例全绿

- [x] **[P1] [1h]** 新增 `tests/storage.test.ts`，参考 `guidance.test.ts` 的 `createMemoryStorage` 模式：
  - `loadFromStorage`：空存储返回 null，正常值返回解析结果，格式错误时的降级行为（返回 null 或默认值）
  - `saveToStorage`：正常写入，覆盖已有值
  - 验证：`npm run test` 通过，storage.test.ts 中 > 4 个用例全绿

### UI 定位说明

- [x] **[P2] [1h]** 新增 `nova-plugin/docs/command-generator-usage.md`，内容包含：
  - 工具定位：离线命令构建助手，帮助可视化配置 nova-plugin 命令参数
  - 启动方式：`cd nova-plugin-command-generator && npm install && npm run dev`（访问 localhost:5173）
  - 使用流程：选择命令 → 填写参数 → 复制输出 → 粘贴到 Claude Code
  - 与 nova-plugin 的关系说明
  - 验证：文件存在，内容清晰说明了工具用途

---

## 第二阶段：本周内（3-7天）

### 消除 manifest 双轨维护（P0-02）

- [x] **[P0] [2h]** 在 `nova-plugin/commands/` 的17个 .md 文件中约定并统一 YAML frontmatter 格式：
  - 必填字段：`id`、`stage`、`title`、`destructive-actions`
  - 可选字段：`fields`（参数列表）、`outputs`（输出定义）
  - 验证：所有 17 个 commands/*.md 文件 frontmatter 格式一致

- [x] **[P0] [4h]** 编写 `nova-plugin-command-generator/scripts/build-manifest.mjs` 构建脚本：
  - 读取所有 `nova-plugin/commands/*.md` 的 frontmatter
  - 使用 `gray-matter` 解析（需 `npm install --save-dev gray-matter`）
  - 生成 `src/data/manifest.ts` 文件，头部加 `// AUTO-GENERATED` 注释
  - 验证：`node scripts/build-manifest.mjs` 运行成功，对比生成文件与手动版内容一致

- [x] **[P0] [30min]** 更新 `package.json` scripts：
  - `"build:manifest": "node scripts/build-manifest.mjs"`
  - `"dev"` 改为先运行 `build:manifest` 再启动 vite
  - `"build"` 改为先运行 `build:manifest` 再执行原构建
  - 验证：`npm run dev` 自动触发 manifest 生成，无报错

- [x] **[P0] [15min]** 在 `src/data/manifest.ts` 文件头添加注释标记（`// AUTO-GENERATED - do not edit manually`）
  - 验证：注释存在，开发者打开文件时能立即看到提示

### 文档完善

- [x] **[P1] [3h]** 新增 `nova-plugin/docs/dual-track-design.md`，内容包含：
  - Commands 的用途（完整 prompt，用户直接触发）
  - Skills 的用途（结构化元数据，供 orchestrator 调用）
  - 两者的关系（互补不重复）
  - 新增能力时的双轨维护规范（何时需要更新两处）
  - 验证：文件存在，内容完整回答"为什么有两份文件"

### App.tsx 初步拆分（有测试保护后）

- [x] **[P0] [4h]** 提取 `src/features/scenes/ScenesPanel.tsx`：
  - 将 App.tsx 中 `tab === 'scenes'` 分支逻辑移入新组件
  - 在 App.tsx 中替换为 `<ScenesPanel onSelect={...} />`
  - 前置条件：第一阶段测试已全部通过
  - 验证：App.tsx 行数减少 > 100 行，`npm run test` 全绿，手动测试场景选择功能正常

- [x] **[P0] [4h]** 提取 `src/features/commands/CommandsPanel.tsx`：
  - 将 App.tsx 中 `tab === 'commands'` 分支逻辑移入新组件
  - 在 App.tsx 中替换为 `<CommandsPanel onSelect={...} />`
  - 验证：App.tsx 行数进一步减少，`npm run test` 全绿，手动测试命令选择功能正常

---

## 第三阶段：下月内（中长期演进）

### 能力演进

- [x] **[P1] [2h]** 研究 Claude Code 最新 hooks 规范：
  - 确认 hooks.json 支持的事件类型（PreToolUse/PostToolUse/Stop/Notification）
  - 确认每个 hook 的必填字段和 command 格式
  - 记录到 `nova-plugin/docs/hooks-design.md`
  - 验证：文档中有来自官方规范的字段说明

- [x] **[P1] [4h]** 实现 `nova-plugin/hooks/hooks.json` 中的 PreToolUse hook：
  - 当 Write/Edit/MultiEdit 工具被调用时触发检查
  - 在测试环境（非生产）充分验证行为符合预期
  - 验证：hooks.json 不再为空，在 Claude Code 中验证 hook 触发正常

- [x] **[P1] [2h]** 实现 PostToolUse 审计日志 hook：
  - 写入简单的操作日志（时间戳 + 工具名 + 状态）
  - 验证：工具调用后能在指定位置找到日志记录

### 仓库清洁

- [x] **[P2] [1h]** 评估并处置 `.claude/agents/archive/` 目录：
  - 选项A：将归档目录迁移到独立 git branch `legacy-agents`
  - 选项B：在 `.gitignore` 中排除（需确认 .gitignore 当前规则）
  - 选项C：保留原样，但在 README 或 verify-agents.sh 中增加"归档 token 影响"警告
  - 验证：所选方案执行完毕，`git status` 干净

- [x] **[P2] [30min]** 明确 `.codex/skills/ui-ux-pro-max/` 的处置方式：
  - 如果是实验性 skill → 迁移到 `nova-plugin/skills/` 并按规范改造
  - 如果是临时文件 → 删除或加入 `.gitignore`
  - 验证：`.codex/` 定位不再模糊，有清晰说明或已清理

### 可选：CI 增强与平台化

- [x] **[P2] [2h]** 创建 `schemas/plugin.schema.json`，约束 plugin.json 格式（version 强制 semver）
  - 验证：`ajv validate -s schemas/plugin.schema.json -d nova-plugin/.claude-plugin/plugin.json` 通过

- [x] **[P2] [1h]** 在 CI pipeline 增加 schema 验证 job
  - 验证：PR 中新的 CI job 能检测出格式错误的 plugin.json

- [x] **[P2] [4h]** 创建 `.github/workflows/release.yml` 自动发布流程（触发条件：推送 `v*` tag）
  - 验证：推送测试 tag 后，GitHub Releases 页面自动创建新 release

- [x] **[P2] [1day]** D3 PoC 评估：编写技术可行性文档 `nova-plugin/docs/mcp-server-poc.md`
  - 评估 MCP SDK 接入成本
  - 设计 MCP Server 的 tool 接口（get_command_template/list_commands/build_prompt）
  - 说明与现有 React UI 的共存方案
  - 验证：文档存在，有明确的"建议实施/暂缓"结论

---

## 快速参考：按文件分类的待办

### 需要修改的现有文件
- [x] `README.md` — 版本号
- [x] `nova-plugin/.claude-plugin/plugin.json` — 增加 tags/homepage/repository
- [x] `nova-plugin-command-generator/package.json` — 增加 build:manifest script
- [x] `nova-plugin/commands/*.md`（17个）— 增加统一 frontmatter

### 需要新增的文件
- [x] `.github/workflows/ci.yml`
- [x] `CHANGELOG.md`
- [x] `nova-plugin-command-generator/tests/render.test.ts`
- [x] `nova-plugin-command-generator/tests/promptQuality.test.ts`
- [x] `nova-plugin-command-generator/tests/storage.test.ts`
- [x] `nova-plugin-command-generator/scripts/build-manifest.mjs`
- [x] `nova-plugin/docs/command-generator-usage.md`
- [x] `nova-plugin/docs/dual-track-design.md`
- [x] `nova-plugin/docs/hooks-design.md`（第三阶段）
- [x] `schemas/plugin.schema.json`（第三阶段）
- [x] `.github/workflows/release.yml`（第三阶段）

### 需要重构的文件
- [x] `nova-plugin-command-generator/src/App.tsx` — 提取 ScenesPanel、CommandsPanel，状态下移
- [x] `nova-plugin/hooks/hooks.json` — 填充 hook 配置（第三阶段）

### 验证命令速查
```bash
# 第一阶段验证
cd nova-plugin-command-generator && npm run lint    # 零警告
cd nova-plugin-command-generator && npm run test    # 全绿，> 20 个用例

# 第二阶段验证
node nova-plugin-command-generator/scripts/build-manifest.mjs   # 生成 manifest.ts
cd nova-plugin-command-generator && npm run dev    # 无报错启动

# Agent 验证
bash scripts/verify-agents.sh    # 14-18 agents，orchestrator 存在
```

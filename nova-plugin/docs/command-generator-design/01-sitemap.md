# 信息架构（Sitemap / IA）

目标：在“场景驱动”与“命令驱动”两种入口之间保持一致体验，并支持工作流分步生成与复用。

## 顶层导航（推荐）

### 移动端（iOS Safari / Android Chrome）

- 底部 Tab（5 个以内）：
  - 场景
  - 命令
  - 工作流
  - 历史
  - 设置

### 桌面端

- 顶部导航 + 左侧筛选：
  - 顶部：全局搜索 / 最近使用 / 导出入口
  - 左侧：按阶段/约束强度/场景分类筛选

## 页面/路由草图（SPA）

> 路由仅用于规划前端结构；实现时可按框架习惯调整。

- `/` 场景首页（Scenario Index）
  - 场景分类：需求分析 / 故障排查 / 方案规划 / 计划评审 / 代码评审 / 实施 / 交付
  - 每个场景：推荐“命令”或“工作流”
- `/commands` 命令列表（Command Browser）
  - 分组：Explore → Plan → Review → Implement → Finalize
  - 排序：同阶段内强→中→弱
- `/commands/:commandId` 命令详情（命令定位、字段、示例、进入生成）
- `/generate/:commandId` 单命令生成（Command Generator）
- `/workflows` 工作流模板列表（Workflow Library）
- `/workflows/:workflowId` 工作流分步向导（Workflow Wizard / Stepper）
- `/history` 历史记录（Runs / Drafts）
  - 列表 + 过滤 + 复用/导出/删除
- `/settings` 设置（Defaults / Privacy / Limits）

## 关键弹窗/抽屉（Modal / Sheet）

- 示例选择（Examples）
  - 一键填充表单（不会覆盖用户已编辑的预览文本，除非用户确认）
- 导出（Export）
  - 导出类型：`md`/`txt`/`json`
  - 导出方式：保存到文件（能力允许）/ 下载 / 分享（能力允许）
- 插入文件（Attach / Insert）
  - 选择插入策略：仅路径 / 片段 / 全文
  - 片段参数：前 N 行或前 N 字符

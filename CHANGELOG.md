# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/).

---

## [1.0.6] - 2026-02-12

### Added
- 新增 nova-plugin Skills 目录，17 个命令均配套对应的 SKILL.md 技能文件
- Skills 支持 Claude Code 自动发现与调用（`nova-*` 命名空间）

---

## [1.0.5] - 2026-02-06

### Changed
- 格式化多处文档，统一代码块和章节排版
- 修改网站链接和徽章引用地址

### Added
- 更新 17 个命令文件内容，补充使用示例和约束说明

---

## [1.0.4] - 2026-02-03

### Changed
- 优化 14 个专项 Agent 的描述和路由规则
- 调整 orchestrator agent 的任务分发逻辑

---

## [1.0.3] - 2026-01-22

### Added
- 新增多篇使用文档（中英双语）
- 补充 Agent 概览说明与使用场景示例

### Changed
- 修正 README 标题格式
- 更新版本号至 1.0.3

---

## [1.0.2] - 2026-01-16

### Fixed
- 修复 nova-plugin-command-generator 中表单草稿状态异常的 bug

### Changed
- 格式化所有命令文件（统一缩进与换行）
- `.gitignore` 补充忽略规则

---

## [1.0.1] - 2026-01-15

### Added
- 新增 `nova-plugin-command-generator`：基于 React + Vite 的可视化命令构建工具
  - 支持场景选择、命令选择、参数填写、历史记录
  - 集成引导流程（explore → plan → review → implement → finalize）
  - 附件上传与模板变量替换功能
- 新增 Agent 文件（14 个专项 Agent）
- 新增 telemetry 与 ErrorBoundary 错误处理

### Changed
- 将命令生成器 Tab 重构为独立 Feature 组件（GeneratorPanel、HistoryPanel、WorkflowRunPanel）

---

## [1.0.0] - 2026-01-11

### Added
- 初始化项目结构：`nova-plugin` + `.claude-plugin/marketplace.json`
- 17 个命令定义（Explore / Plan / Review / Implement / Finalize 五阶段）
- MIT 开源协议
- 中英双语 README 文档

[1.0.6]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/lliangcol/llm-plugins-fusion/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/lliangcol/llm-plugins-fusion/releases/tag/v1.0.0

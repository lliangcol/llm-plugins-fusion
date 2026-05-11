# Delivery Documentation Prompt

Use this prompt after a change is implemented or ready for handoff.

```text
请基于当前代码变更和项目事实生成交付文档包。

输入：
- 变更范围：<BASE_BRANCH_OR_COMMIT | CHANGED_FILES_LIST | REVIEW_ARTIFACT>
- 输出目录：<OUTPUT_DIR>
- 目标读者：<client | admin-frontend | backend | qa | release | all>
- 项目本地规则：<AGENTS_OR_CLAUDE_PATH_IF_AVAILABLE>

严格约束：
- 只基于代码、diff、需求文档、review artifact 和验证输出写文档。
- 不发明接口、字段、错误码、配置或部署步骤。
- 不复制私有 endpoint、凭据、真实用户数据或环境值到公开文档。
- 不输出完整代码；只引用必要文件、类、方法或行为。
- 如果证据不足，写“待确认”，不要猜。

需要生成的文档：
1. api-notes.md
   - 接口地址或路由
   - 方法、请求头、参数、必填、类型
   - 返回结构、错误码、示例
   - 使用场景和兼容性
2. test-plan.md
   - 影响点
   - 测试场景
   - 边界条件
   - 数据库或数据状态验证
   - 回归范围
3. implementation-notes.md
   - 代码变更说明
   - 调用链
   - 关键类/方法/模块
   - 持久化、缓存、配置、异步任务影响
4. deployment-notes.md
   - 配置、迁移、缓存刷新、监控、回滚
   - 上线前后检查
5. handoff-summary.md
   - 已完成
   - 验证
   - 风险
   - 后续事项

最终回复只给：
- 文档路径
- 生成依据
- 无法确认的事项
```

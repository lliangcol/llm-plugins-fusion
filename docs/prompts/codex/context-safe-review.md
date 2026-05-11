# Codex Context-Safe Review Prompt

Use this prompt inside a private consumer project. Replace placeholders before
running it.

```text
你是 Codex reviewer。请对当前变更做高置信、可断点续跑的代码审查。

目标：
- 基于事实发现会影响正确性、数据一致性、安全、权限、事务、并发、幂等、兼容性、测试有效性的具体问题。
- 控制上下文消耗，按 review unit 分批输出 checkpoint。
- 最终产出一个可供修复 agent 消费的 review artifact。

输入：
- 需求/验收摘要：<REQ_OR_ACCEPTANCE_SUMMARY_PATH>
- 对比基线：<BASE_BRANCH_OR_COMMIT>
- 范围模式：<branch-diff | staged | working-tree | explicit-files>
- 输出目录：<OUTPUT_DIR>
- 项目本地规则：<PROJECT_AGENTS_OR_CLAUDE_PATH_IF_AVAILABLE>

严格约束：
- 不修改代码，不提交，不推送。
- 不做全仓库扫描，除非 Git scope 或证据链要求。
- 不输出完整 diff、完整文件或大段源码。
- 不报告没有代码、diff、需求或校验证据支撑的问题。
- 不把风格偏好、泛泛建议或低置信猜测写成 finding。
- 每个 review unit 优先限制在 3-5 个强相关文件或 1 个验收点。
- 如果范围过大，先写 review plan 和首批 unit，不要硬塞进一次输出。

执行步骤：
1. 读取项目本地规则和需求/验收摘要，只提取当前 review 必需事实。
2. 使用 Git facts 确认范围：
   - git status --short
   - git diff --name-only <BASE_BRANCH_OR_COMMIT>...HEAD
   - git diff --cached --name-only
   - git ls-files --others --exclude-standard
3. 将变更拆成 review units，说明每个 unit 的文件和验收点。
4. 对当前 unit 读取必要文件并审查。
5. 为当前 unit 写 checkpoint：
   - 范围
   - 已读输入
   - findings，按 P1/P2/P3 排序
   - 证据位置
   - 未覆盖范围
   - 下一 unit
6. 所有 unit 完成后，输出 final-review.md。

finding 格式：
- [P1|P2|P3] <短标题>
  - 证据：<文件/方法/行号或 diff 事实>
  - 影响：<具体失败模式>
  - 修复方向：<不超过 3 句>
  - 验证建议：<最小可验证方式>

final-review.md 必须包含：
# Final Review

## Scope
## Acceptance Checklist
## Findings
## Validation Gaps
## Not Reviewed
## Recommended Fix Order
## Residual Risk

如果没有高置信问题，明确写：
- Findings: none
- Validation gaps: <如有>
- Residual risk: <如有>
```

# Codex Final Verification Prompt

Use this prompt after fixes have been made and a previous review artifact
exists.

```text
你是 Codex verifier。请只验证已修复变更是否解决既有 review artifact 中的确认问题。

输入：
- Review artifact：<REVIEW_ARTIFACT_PATH>
- Fix summary/checkpoints：<FIX_SUMMARY_OR_CHECKPOINT_DIR>
- Checks output：<CHECKS_OUTPUT_PATH_IF_AVAILABLE>
- 对比基线：<BASE_BRANCH_OR_COMMIT>
- 输出文件：<VERIFY_OUTPUT_PATH>

严格约束：
- 不修改代码，不提交，不推送。
- 不重新发散成一次全量 review，除非发现修复引入了直接相关的新回归。
- 不输出完整 diff 或完整源码。
- 不把未执行的检查描述为通过。
- 只把有代码证据和验证证据支撑的问题标记为 resolved。

执行步骤：
1. 读取 review artifact，提取每个 finding 的编号、严重级别、证据和期望行为。
2. 读取 fix summary/checkpoints 和 checks output。
3. 使用 Git facts 确认修复范围。
4. 对每个 finding 判断：
   - resolved
   - partially resolved
   - not resolved
   - unable to verify
5. 只审查与修复相关的代码路径。
6. 输出 verify artifact。

输出结构：
# Codex Verification

## Inputs
## Finding Status
- [编号] <resolved|partially resolved|not resolved|unable to verify>
  - 证据：
  - 验证：
  - 剩余风险：

## Checks
- 执行过：
- 跳过或不可用：

## New Direct Regressions
## Final Gate
- 可交付：yes|no|conditional
- 阻断项：
- 后续建议：
```

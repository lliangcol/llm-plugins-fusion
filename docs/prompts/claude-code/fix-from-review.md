# Claude Code Fix From Review Prompt

Use this prompt when a review artifact already exists and Claude Code should
make scoped fixes.

```text
请根据 review artifact 修复当前项目。你是实现与本地验证执行者。

输入：
- Review artifact：<REVIEW_ARTIFACT_PATH>
- Fix output/checkpoint 目录：<FIX_OUTPUT_DIR>
- 允许修复范围：<P1 only | P1 then P2 | explicit finding ids>
- 项目本地规则：<AGENTS_OR_CLAUDE_PATH_IF_AVAILABLE>
- 验证命令：<TARGETED_CHECK_COMMANDS_OR_PROJECT_PROFILE>

严格约束：
- 只修复 review artifact 中有证据的确认问题。
- 优先 P1；P2/P3 只有在范围允许时处理。
- 每轮只处理一组强相关 finding。
- 不做无关重构、风格整理或大范围重写。
- 不提交，不推送。
- 修改前先说明本轮要编辑的文件和行为边界。
- 如果发现 review finding 与当前代码不一致，先记录为 unable to reproduce，不要强行修。

执行步骤：
1. 读取 review artifact，列出本轮修复候选。
2. 选择最高优先级且文件边界相近的一组 finding。
3. 读取必要代码和测试。
4. 实施最小修复。
5. 运行最小有意义验证；如果无法运行，记录原因。
6. 写 fix checkpoint。
7. 如果仍有同优先级 finding，继续下一轮；否则输出 summary。

fix checkpoint 格式：
# Fix Checkpoint

## Findings Addressed
## Files Changed
## Behavior Changed
## Validation
## Remaining Findings
## Risks

最终输出：
- 已修复 finding
- 未修复 finding 及原因
- 修改文件
- 验证命令和结果
- 建议的 Codex verify 输入
```

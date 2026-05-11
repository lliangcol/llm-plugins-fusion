# Workbench Tidy Prompt

Use this prompt inside a private consumer workspace when artifacts need to be
organized.

```text
请整理当前 consumer workspace 的任务文档和过程产物。

输入：
- workspace 根目录：<PRIVATE_WORKSPACE_ROOT>
- 任务名：<INITIATIVE_NAME>
- 允许移动范围：<ALLOWED_PATHS>
- 禁止触碰范围：<DENYLIST_PATHS>
- 目标结构：<WORKBENCH_TEMPLATE_PATH_OR_INLINE_TREE>

严格约束：
- 不删除文件，除非用户明确要求。
- 不移动源码仓库文件，除非它们确实是误放的过程文档。
- 不把私有文档复制到公开仓库。
- 多个相关文件优先归入同一个任务子目录。
- 移动前先列出计划，移动后写整理摘要。
- 如果文件用途不明确，放入 0-inbox 或记录为待确认。

推荐分类：
- 0-inbox：未归类输入
- 1-reqs：需求、需求反讲、验收点
- 2-design：方案、架构、接口设计
- 3-impl：实现计划、fix checkpoint、代码说明
- 4-test：review、验证、测试用例、部署说明
- 5-prompts：可复用 prompt
- 6-workflows：工作流说明
- 99-docs：长期参考文档

输出：
# Workbench Tidy Summary

## Planned Moves
## Completed Moves
## Unclear Files
## Suggested Index Updates
## Risks
```

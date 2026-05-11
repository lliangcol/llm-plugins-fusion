# HTML Artifact Prompt

Use this prompt when a plan, review, report, or handoff would be easier to
review as a visual HTML artifact. HTML artifacts are derived reading artifacts,
not the source of truth.

```text
请基于已有项目事实生成一个可审阅的 HTML 制品。

输入：
- 源材料：<REQ_OR_PLAN_OR_REVIEW_OR_DIFF_OR_VALIDATION_PATHS>
- 输出路径或目录：<OUTPUT_PATH_OR_DIR>
- 目标读者：<maintainer | reviewer | qa | release | stakeholder | all>
- 制品类型：<plan | review | report | handoff | comparison | exploration>
- 是否需要交互：<none | lightweight controls | copyable summary>
- 项目本地规则：<AGENTS_OR_CLAUDE_PATH_IF_AVAILABLE>

严格约束：
- HTML 是派生阅读制品，不是事实源。
- 事实源仍是 Markdown、代码、diff、review artifact、validation output。
- 只基于输入材料和项目事实生成内容；证据不足处写“待确认”。
- 不发明接口、字段、错误码、配置、部署步骤或业务规则。
- 不包含私有 endpoint、凭据、真实用户数据、私有仓库地址或个人绝对路径。
- 默认生成单文件 HTML，CSS 内联。
- 默认不使用外部 CDN、远程 JavaScript、远程字体或远程图片。
- 默认不发起网络请求，不提交表单，不写 localStorage 或 sessionStorage。
- 不输出完整源码、完整 diff 或大段日志；只引用必要文件、模块、行为和证据。
- 长期保留的 HTML 必须配套 Markdown 摘要或来源说明。

推荐结构：
1. 标题、制品类型、生成依据和更新时间。
2. Executive summary：用 5-8 条说明最重要结论。
3. Evidence map：列出引用的需求、diff、review、验证输出或代码位置。
4. Main view：按制品类型呈现计划、评审、报告、交付或对比内容。
5. Risks and gaps：明确风险、未知项、跳过的验证和待确认事项。
6. Source summary：说明事实源路径，以及相邻 Markdown 摘要路径。

视觉要求：
- 信息密度高于普通 Markdown，但保持可读。
- 用表格、分组、颜色、流程图或轻量交互表达复杂关系。
- 颜色只用于表达状态或严重级别，不用作唯一信号。
- 移动端和桌面端都应能阅读。
- 避免装饰性动画；交互只服务于审阅、筛选或复制摘要。

输出要求：
- 写入 HTML 到指定路径或指定目录下的清晰文件名。
- 同时写入相邻 Markdown 摘要，或在已有 Markdown checkpoint 中补充来源说明。
- 最终回复只给：
  - HTML 路径
  - Markdown 摘要或来源说明路径
  - 使用的事实源
  - 跳过的验证或待确认事项
```

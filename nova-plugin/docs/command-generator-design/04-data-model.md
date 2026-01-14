# 元数据与状态草图（Data Model Sketch）

目标：用一份机器可读 `manifest` 驱动表单与模板拼装；用 `RunSession` 存储用户生成历史与工作流上下文变量。

## 1) manifest（建议：JSON）

> MVP 建议手工维护（15 个命令可控）；后续可再做半自动抽取/校对。

### 1.1 结构（示意）

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-01-14T00:00:00Z",
  "commands": [
    {
      "id": "senior-explore",
      "displayName": "/senior-explore",
      "stage": "explore",
      "constraintLevel": "strong",
      "description": "深度探索与分析（禁止方案/实现）",
      "inputMode": "structured",
      "fields": [
        { "id": "INTENT", "label": "Intent", "type": "multiline", "required": true, "bindable": false },
        { "id": "CONTEXT", "label": "Context", "type": "multiline", "required": false, "bindable": true },
        { "id": "CONSTRAINTS", "label": "Constraints", "type": "multiline", "required": false, "bindable": true },
        { "id": "DEPTH", "label": "Depth", "type": "select", "required": false, "options": ["quick", "normal", "deep"], "default": "normal" },
        { "id": "EXPORT_PATH", "label": "Export path", "type": "path", "required": false, "bindable": true }
      ],
      "template": "/senior-explore\nINTENT: {{INTENT}}\nCONTEXT:\n{{CONTEXT}}\nCONSTRAINTS:\n{{CONSTRAINTS}}\nDEPTH: {{DEPTH}}\nEXPORT_PATH: {{EXPORT_PATH}}\n",
      "outputs": [
        { "id": "analysis_export_path", "sourceFieldId": "EXPORT_PATH", "type": "path" }
      ]
    }
  ],
  "workflows": [
    {
      "id": "workflow-a-new-feature",
      "title": "新需求开发（需求不清晰）",
      "steps": [
        { "stepId": "s1", "commandId": "senior-explore", "optional": false },
        {
          "stepId": "s3",
          "commandId": "produce-plan",
          "optional": true,
          "autoBindings": [
            { "fromVar": "analysis_export_path", "toFieldId": "ANALYSIS_INPUTS", "mode": "appendListItemIfPresent" }
          ]
        }
      ]
    }
  ]
}
```

## 2) RunSession（生成记录 / 草稿）

```json
{
  "id": "run_20260114_001",
  "createdAt": "2026-01-14T12:00:00Z",
  "mode": "single",
  "commandId": "produce-plan",
  "workflowId": null,
  "workflowStepId": null,
  "fields": {
    "PLAN_OUTPUT_PATH": "docs/plans/xxx.md",
    "PLAN_INTENT": "..."
  },
  "attachedFiles": [
    { "name": "req.md", "pathHint": "docs/req.md", "insertMode": "snippet", "snippetLimit": 2000 }
  ],
  "resolvedVariables": {
    "plan_output_path": "docs/plans/xxx.md"
  },
  "commandText": "/produce-plan\nPLAN_OUTPUT_PATH: ...\n..."
}
```

## 3) 变量解析与缺失策略（草图）

- 解析顺序（建议）：
  1) 工作流上下文变量（上一步产物）
  2) 当前步骤用户自定义变量（手动注册）
  3) 字段默认值（default）
- 缺失处理：
  - 预览中：`<<MISSING:var>>`
  - 生成按钮：默认阻断“必填字段缺失”；变量缺失可配置为“允许生成但提示”

## 4) 导出能力检测（桌面/移动端差异）

- `supportsFileSystemAccess`: `window.showSaveFilePicker` 是否存在（桌面 Chrome/Edge 可能为 true）
- `supportsShare`: `navigator.share` 是否存在（移动端常见）
- 默认策略（与需求一致）：
  - 先保存到应用内（IndexedDB）
  - 导出时：优先保存到文件（若支持），否则下载；移动端优先显示“分享”


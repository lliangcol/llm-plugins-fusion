# MCP Server PoC 评估

## 背景

Model Context Protocol（MCP）是 Anthropic 推出的开放协议，允许 AI 应用以标准化方式访问外部工具和数据源。
本文档评估将 nova-plugin 核心能力封装为 MCP Server 的可行性与接入成本。

---

## 目标

| 目标 | 说明 |
|------|------|
| 命令生成服务化 | 将 `nova-plugin-command-generator` 的模板渲染能力暴露为 MCP tool |
| 多平台复用 | 让支持 MCP 的客户端（Claude Desktop、IDE 插件等）均可调用 |
| 低维护成本 | 不引入新的数据库依赖，继续使用现有 manifest.ts 数据 |

---

## 现有能力盘点

```
nova-plugin-command-generator/
├── src/data/manifest.ts        # 命令定义数据源（17 个命令）
├── src/utils/render.ts         # renderTemplate(command, form, vars) → string
├── src/utils/promptQuality.ts  # evaluateIntent/Context/Constraints(str) → feedback
└── src/utils/storage.ts        # localStorage 封装（不适合服务端）
```

可直接服务化的核心函数：
- `renderTemplate` — 接受命令 ID + 字段值 → 生成完整 prompt 文本
- `evaluateIntent` / `evaluateContext` / `evaluateConstraints` — 质量评估反馈

---

## MCP SDK 接入方案

### SDK 选型

| SDK | 语言 | 维护方 | 适用场景 |
|-----|------|--------|----------|
| `@modelcontextprotocol/sdk` | TypeScript/Node | Anthropic | 本项目首选（已用 TS） |
| `mcp` | Python | Anthropic | 适合数据分析场景 |
| FastMCP | Python | 社区 | 快速原型 |

### 推荐方案：TypeScript MCP Server

**新文件结构：**

```
nova-plugin-command-generator/
└── src/
    └── mcp/
        ├── server.ts         # MCP Server 入口
        ├── tools/
        │   ├── list-commands.ts    # 列出所有命令
        │   ├── generate-prompt.ts  # 生成 prompt 文本
        │   └── evaluate-quality.ts # 质量评估
        └── index.ts
```

### Tool 接口设计

#### Tool 1: `nova_list_commands`

```typescript
{
  name: 'nova_list_commands',
  description: '列出 nova-plugin 所有可用命令，支持按阶段筛选',
  inputSchema: {
    type: 'object',
    properties: {
      stage: {
        type: 'string',
        enum: ['explore', 'plan', 'review', 'implement', 'finalize'],
        description: '按开发阶段筛选（可选）'
      }
    }
  }
}
```

**返回：** 命令列表（id、displayName、description、constraintLevel、stage）

---

#### Tool 2: `nova_generate_prompt`

```typescript
{
  name: 'nova_generate_prompt',
  description: '根据命令 ID 和字段值生成完整的 Claude Code prompt 文本',
  inputSchema: {
    type: 'object',
    required: ['commandId', 'fields'],
    properties: {
      commandId: {
        type: 'string',
        description: '命令标识符（如 "senior-explore"）'
      },
      fields: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: '字段 ID → 字段值 的映射'
      },
      variables: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: '自定义变量（可选），用于模板中的 {{VAR_NAME}} 替换'
      }
    }
  }
}
```

**返回：** `{ prompt: string, missingFields: string[], quality: { intent, context, constraints } }`

---

#### Tool 3: `nova_evaluate_quality`

```typescript
{
  name: 'nova_evaluate_quality',
  description: '评估 prompt 文本的质量（意图/上下文/约束三个维度）',
  inputSchema: {
    type: 'object',
    required: ['text', 'dimension'],
    properties: {
      text: { type: 'string' },
      dimension: {
        type: 'string',
        enum: ['intent', 'context', 'constraints']
      }
    }
  }
}
```

**返回：** `{ status: 'ok' | 'warning' | 'weak', message: string }`

---

## 接入成本估算

### 工作量

| 任务 | 预估时间 | 说明 |
|------|----------|------|
| 安装 SDK，搭建 server.ts 骨架 | 2h | `npm install @modelcontextprotocol/sdk` |
| 实现 3 个 tool handler | 4h | 复用现有 render.ts / promptQuality.ts |
| 将 manifest 提取为纯 Node 模块 | 2h | 去掉 React 依赖，仅保留数据逻辑 |
| 添加 stdio 传输层 | 1h | `StdioServerTransport` |
| 测试 + 文档 | 3h | Vitest + MCP Inspector |
| **合计** | **约 12h** | |

### 依赖变更

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

无新数据库依赖，无服务器部署需求（stdio 模式本地运行）。

---

## 集成方式

### Claude Desktop 配置示例

```json
{
  "mcpServers": {
    "nova-plugin": {
      "command": "node",
      "args": ["path/to/nova-plugin-command-generator/dist/mcp/server.js"]
    }
  }
}
```

### Claude Code 配置示例

```bash
claude mcp add nova-plugin node path/to/nova-plugin-command-generator/dist/mcp/server.js
```

---

## 风险与约束

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| manifest.ts 含 React 依赖（import type） | 低 | 提取纯数据部分到独立文件 |
| stdio 模式不支持多客户端并发 | 低 | 单用户本地工具，无需并发 |
| MCP 协议版本迭代 | 中 | 锁定 SDK 版本，CI 中测试 |
| 字段类型不匹配（textarea/boolean） | 低 | server 端做类型强制转换 |

---

## 结论与建议

**接入可行性：高。** 现有 `render.ts` 和 `promptQuality.ts` 不依赖浏览器 API，可直接在 Node 环境运行。核心障碍仅是将 manifest 数据从 React 模块中分离（约 2 小时工作）。

**推荐执行顺序：**

1. 将 `src/data/manifest.ts` 中的数据提取为 `src/data/manifest-data.ts`（纯数据，无框架依赖）
2. 创建 `src/mcp/server.ts`，实现 3 个 tool
3. 在 `package.json` 中添加 `"mcp": "node dist/mcp/server.js"` script
4. 使用 [MCP Inspector](https://github.com/modelcontextprotocol/inspector) 本地测试
5. 更新 `nova-plugin/docs/command-generator-usage.md` 添加 MCP 使用说明

**不建议现阶段实现的原因：**
- 当前 React UI 已满足主要使用场景
- MCP 集成需要先完成 manifest 数据解耦（需专项重构）
- 建议在 v1.1.0 版本迭代中一并规划

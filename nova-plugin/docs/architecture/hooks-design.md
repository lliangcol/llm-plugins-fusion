# Hooks 设计文档

## 概述

本文档描述 nova-plugin 的 hook 设计，基于 Claude Code Hooks 官方规范。
实现文件：`nova-plugin/hooks/hooks.json` + `nova-plugin/hooks/scripts/`

---

## Claude Code Hooks 规范速查

### 事件类型

| 事件 | 触发时机 | 能否阻断 | Matcher 对象 |
|------|----------|----------|--------------|
| `PreToolUse` | 工具执行**前** | 是 | 工具名（正则 `\|` 分隔） |
| `PostToolUse` | 工具执行**后** | 是（返回 block 决策） | 工具名 |
| `Stop` | Claude 完成响应时 | 是 | 无（每次触发） |
| `Notification` | Claude Code 发送通知时 | 否 | 通知类型 |

### stdin 数据结构

每个 hook 脚本通过 **stdin** 接收 JSON：

```json
{
  "session_id": "abc123",
  "cwd": "/project",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Write",
  "tool_input": { "file_path": "...", "content": "..." }
}
```

PostToolUse 额外包含：

```json
{
  "tool_response": { "filePath": "...", "success": true },
  "tool_use_id": "toolu_01ABC..."
}
```

### 退出码规则

| 退出码 | 含义 |
|--------|------|
| `0` | 允许继续；stdout JSON 被解析为决策；纯文本作为上下文 |
| `2` | **阻断操作**；stderr 作为错误反馈传给 Claude |
| 其他 | 非阻断，stderr 仅在 verbose 模式显示 |

### 钩子配置结构

```json
{
  "hooks": {
    "PreToolUse": [
      {
            "matcher": "Write|Edit|MultiEdit",
            "hooks": [
              {
                "type": "command",
                "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh\"",
                "timeout": 10,
                "statusMessage": "检查文件写入..."
          }
        ]
      }
    ]
  }
}
```

---

## nova-plugin Hook 设计

### Hook 1：PreToolUse — 写入前检查

**目标：** 在 Write / Edit / MultiEdit 操作前检查以下规则：

| 检查项 | 规则 | 处理 |
|--------|------|------|
| 敏感信息检测 | 内容含 `password|secret|token|api_key`（硬编码模式）| exit 2 阻断 |
| hooks.json 结构校验 | 写入 `hooks/hooks.json` 时验证 JSON 格式 | exit 2 阻断 |

**实现：** `nova-plugin/hooks/scripts/pre-write-check.sh`

### Hook 2：PostToolUse — 审计日志

**目标：** 记录所有 Write / Edit / MultiEdit / Bash 操作的审计日志，格式：

```
[2026-03-18T07:00:00Z] Write /path/to/file.ts SUCCESS
[2026-03-18T07:00:01Z] Bash  node scripts/validate-schemas.mjs SUCCESS
```

日志写入：`${CLAUDE_PLUGIN_DATA}/audit.log`（本地，不提交 git）

**实现：** `nova-plugin/hooks/scripts/post-audit-log.sh`

---

## 文件结构

```
nova-plugin/hooks/
├── hooks.json                    ← hook 主配置
└── scripts/
    ├── pre-write-check.sh        ← PreToolUse 检查脚本
    └── post-audit-log.sh         ← PostToolUse 审计日志脚本
```

---

## 配置文件位置说明

| 位置 | 范围 | 可共享 |
|------|------|--------|
| `~/.claude/settings.json` | 全局 | 否 |
| `.claude/settings.json` | 项目 | 是 |
| `nova-plugin/hooks/hooks.json` | 插件启用时 | 是（随插件分发） |

插件 hooks 仅在用户启用该插件后生效，不影响其他项目。

## Windows 前置条件

`hooks.json` 通过 `bash "<script>.sh"` 调用脚本。Windows PowerShell 默认不提供
Bash，因此在 Windows 上需要安装 Git Bash、WSL，或其他可在 PATH 中解析为
`bash` 的兼容运行时。缺少 Bash 时，PowerShell 下的 `bash -n` 语法检查和
Claude Code hook 执行都会失败。

---

## 环境变量

脚本中可用的路径变量：

| 变量 | 含义 |
|------|------|
| `$CLAUDE_PROJECT_DIR` | 项目根目录 |
| `${CLAUDE_PLUGIN_ROOT}` | 插件目录（`nova-plugin/`） |
| `${CLAUDE_PLUGIN_DATA}` | 插件数据目录（持久存储，不在项目内） |

---

## 扩展计划

以下事项是未排期候选，不属于当前 `2.1.0` 已发布能力，也不作为下一版本承诺。

| 状态 | 计划 |
|------|------|
| Deferred | 实现 Stop Hook：在 finalize 命令后校验 CHANGELOG 已更新 |
| Deferred | 实现 Notification Hook：`permission_prompt` 时记录危险操作请求 |
| Deferred | HTTP Hook：将审计日志推送到本地 webhook（可选） |

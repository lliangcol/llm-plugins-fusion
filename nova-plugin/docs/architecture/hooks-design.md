# Hooks 设计文档

## 概述

本文档描述 nova-plugin 的 hook 设计，基于 Claude Code Hooks 官方规范中的
命令型 hook 子集。实现文件：`nova-plugin/hooks/hooks.json` +
`nova-plugin/hooks/scripts/`

---

## Claude Code Hooks 规范速查

### 事件类型

| 事件 | 触发时机 | 能否阻断 | Matcher 对象 |
|------|----------|----------|--------------|
| `PreToolUse` | 工具执行**前** | 是 | 工具名（正则 `\|` 分隔） |
| `PostToolUse` | 工具执行**后** | 否；操作已经完成 | 工具名 |
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
| `0` | hook 不返回阻断决定；后续仍进入正常权限流程，不表示授权 |
| `2` | **阻断操作**；stderr 作为错误反馈传给 Claude |
| 其他 | 非阻断，stderr 仅在 verbose 模式显示 |

### 钩子配置结构

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|NotebookEdit",
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

### 当前分发契约

`nova-plugin/hooks/scripts/hooks-schema.mjs` 是 nova-plugin 当前分发
`hooks.json` 的白名单校验器，不是 Claude Code hooks 全量 schema。当前
只允许：

| 维度 | 当前允许值 |
|------|------------|
| 事件 | `PreToolUse`, `PostToolUse` |
| Entry 字段 | `matcher`, `hooks` |
| Hook 类型 | `type: "command"` |
| Hook 字段 | `type`, `command`, `timeout`, `statusMessage`, `async` |
| Shell 调用 | `.sh` 脚本必须通过 `bash "${CLAUDE_PLUGIN_ROOT}/..."` 调用 |
| Active runtime | Bash `.sh` files are thin launchers; Node.js 20+ `.mjs` files own all hook business logic. |

`Stop`、`Notification`、非 command hook 类型、额外字段或其它 Claude Code
未来 schema 字段必须先补 fixture、脚本行为和文档，再放开校验。不要为了兼容
未知字段而把校验器改成 pass-through。

### Hook 1：PreToolUse — 写入前检查

**目标：** 在 Write / Edit / NotebookEdit 操作前检查以下规则：

| 检查项 | 规则 | 处理 |
|--------|------|------|
| 敏感信息检测 | 内容含 `password|secret|token|api_key`（硬编码模式）| exit 2 阻断 |
| payload/runtime 校验 | Node 缺失、payload 非法或 Edit 无法可靠重构 | exit 2 阻断 |
| 目标类型检查 | 已存在的 Write/Edit 目标是符号链接或非普通文件 | exit 2 阻断 |
| NotebookEdit | 无法从 payload 可靠重构完整 notebook proposed content | exit 2 阻断 |
| hooks.json 结构校验 | 对 Write 内容或 Edit proposed content 验证 JSON/schema | exit 2 阻断 |

**Active launcher:** `nova-plugin/hooks/scripts/pre-write-check.sh`

**Active implementation:** `nova-plugin/hooks/scripts/pre-write-check.mjs`

敏感信息检测规则由 `nova-plugin/runtime/secret-rules.mjs` 统一维护。Bash
启动器只解析 Node 路径；Node 缺失时 fail closed。设置
`NOVA_WRITE_GUARD_DISABLED=1` 会打印警告并返回“无决定”，仅用于显式临时
bypass，不得作为 release evidence。

### Hook 2：PostToolUse — 审计日志

**目标：** 记录所有 Write / Edit / NotebookEdit / Bash 操作的审计日志，格式：

```
[2026-03-18T07:00:00Z] Write /path/to/file.ts SUCCESS
[2026-03-18T07:00:01Z] Bash  node scripts/validate-schemas.mjs SUCCESS
```

日志写入：`${CLAUDE_PLUGIN_DATA}/audit.log`（本地，不提交 git）。日志位置、
权限、轮转、禁用方式与 best-effort redaction 边界见
[`docs/privacy/data-handling.md`](../../../docs/privacy/data-handling.md)。

**Active launcher:** `nova-plugin/hooks/scripts/post-audit-log.sh`

**Active implementation:** `nova-plugin/hooks/scripts/post-audit-log.mjs`

---

## 文件结构

```
nova-plugin/hooks/
├── hooks.json                    ← hook 主配置
└── scripts/
    ├── pre-write-check.sh        ← fail-closed Bash 启动器
    ├── pre-write-check.mjs       ← active Node PreToolUse 实现
    ├── post-audit-log.sh         ← non-blocking Bash 启动器
    └── post-audit-log.mjs        ← active Node PostToolUse 实现
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

`hooks.json` 通过 Bash 启动器调用 Node.js 20+ active 实现。Windows 需要 Git
Bash、WSL 或其他可在 PATH 中解析为 `bash` 的兼容运行时，并需要可由 Bash
发现的 `node`/`node.exe`。缺少 Node 时 PreToolUse fail closed；PostToolUse
audit logger 只报告 warning，因为操作已经完成。

---

## 环境变量

脚本中可用的路径变量：

| 变量 | 含义 |
|------|------|
| `$CLAUDE_PROJECT_DIR` | 项目根目录 |
| `${CLAUDE_PLUGIN_ROOT}` | 插件目录（`nova-plugin/`） |
| `${CLAUDE_PLUGIN_DATA}` | 插件数据目录（持久存储，不在项目内） |
| `NOVA_WRITE_GUARD_DISABLED=1` | 显式临时禁用 write guard；不属于可接受发布证据 |
| `NOVA_AUDIT_DISABLED=1` | 禁用本地 audit log |

## 安全边界

PreToolUse matcher 不包含 Bash，因此 `cat > file`、`sed -i` 或脚本生成文件
不会经过 proposed-content guard。该 hook 是 guardrail，不是 sandbox；Bash
写入仍依赖 Claude 权限、sandbox、CI secret scan 和 release gate。

---

## 扩展计划

以下事项从 `2.1.0` 起一直是未排期候选，在当前 `2.4.1` 中仍未发布，
也不作为下一版本承诺。

| 状态 | 计划 |
|------|------|
| Deferred | 实现 Stop Hook：在 finalize 命令后校验 CHANGELOG 已更新 |
| Deferred | 实现 Notification Hook：`permission_prompt` 时记录危险操作请求 |
| Deferred | HTTP Hook：将审计日志推送到本地 webhook（可选） |

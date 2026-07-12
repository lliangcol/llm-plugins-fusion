# Hooks 设计文档

<!-- generated:project-state:start -->
## Current Machine-Derived Project Facts

Do not edit this block by hand. It is synchronized by
`node scripts/sync-doc-facts.mjs --write` from repository domain sources and
`governance/product-lanes.json`.

- Plugin: `nova-plugin@3.1.0`; production plugins: 1; public path: `nova-plugin/`
- Runtime: Node.js `>=22`; distributed Bash helpers: `3.2+`
- Inventory: 21 commands, 21 skills, 6 active agents, 8 capability packs
- Workflow contract: schema v4, namespace `nova-plugin`, 21 workflows
- Package scripts: `check` is present; `build` is absent
- Active product lanes: `workflow-framework`, `single-plugin-delivery`, `release-candidate-promotion`, `live-assistant-evaluation`, `generic-framework-kernel`
- Planned product lanes: None
- Deferred product lanes: `production-multi-plugin-layout`, `public-portal`, `runtime-dynamic-loading`, `broad-domain-command-expansion`
- Release model: `candidate-and-promotion`
- Active PreToolUse launcher: `bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh"`, `bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-bash-check.sh"`
- Active PostToolUse launcher: `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-write-verify.mjs`, `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-audit-log.mjs`
<!-- generated:project-state:end -->

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
| Active runtime | Node.js 22+ `.mjs` files own hook business logic; PreToolUse keeps a Bash fail-closed launcher, while post-use verification and audit events use direct Node exec form. |

`Stop`、`Notification`、非 command hook 类型、额外字段或其它 Claude Code
未来 schema 字段必须先补 fixture、脚本行为和文档，再放开校验。不要为了兼容
未知字段而把校验器改成 pass-through。

### Hook 1：PreToolUse — 写入前检查

**目标：** 在 Write / Edit / NotebookEdit 操作前检查以下规则：

| 检查项 | 规则 | 处理 |
|--------|------|------|
| 敏感信息检测 | 内容含 `password|secret|token|api_key`（硬编码模式）| exit 2 阻断 |
| payload/runtime 校验 | Node 缺失、payload 非法或 Edit 无法可靠重构 | exit 2 阻断 |
| 路径封闭 | 目标不在 project/显式 artifact root、父路径经 symlink/junction 跳转 | exit 2 阻断 |
| 目标类型检查 | 已存在的 Write/Edit 目标是符号链接、非普通文件，或受保护目标有多个 hard links | exit 2 阻断 |
| 内容大小 | Write 或重构后的 Edit 内容超过 10 MiB | exit 2 阻断 |
| NotebookEdit | 无法从 payload 可靠重构完整 notebook proposed content | exit 2 阻断 |
| hooks.json 结构校验 | 仅对 project/plugin 的受保护 hooks 配置验证 JSON/schema；无关的 `config/hooks.json` 不套用 nova schema | exit 2 阻断 |

**Active launcher:** `nova-plugin/hooks/scripts/pre-write-check.sh`

**Active implementation:** `nova-plugin/hooks/scripts/pre-write-check.mjs`

### Hook 1B：PreToolUse — scoped Bash guard

**目标：** 在正常 Bash 权限提示之前执行默认拒绝的 validation command broker。
分发策略仅允许只读 Git、`rg`、`bash -n`、ShellCheck 和版本探测；项目验证器必须
在仓库自己的 `.nova/shell-policy.json` 中按完整 argv 精确登记。组合命令、重定向、
变量/命令替换、未登记解释器与包执行器一律拒绝。允许结果仍要经过 Claude 权限提示
和外部 sandbox；项目策略是仓库审查面，不等于预授权。

**Active launcher:** `nova-plugin/hooks/scripts/pre-bash-check.sh`

**Active implementation:** `nova-plugin/hooks/scripts/pre-bash-check.mjs`

**Distributed policy:** `nova-plugin/runtime/shell-command-policy.json`

**Project exact policy:** `.nova/shell-policy.json`

敏感信息检测规则由 `nova-plugin/runtime/secret-rules.mjs` 统一维护。Bash
启动器只解析 Node 路径；Node 缺失时 fail closed。设置
`NOVA_WRITE_GUARD_DISABLED=1` 会打印警告并返回“无决定”，仅用于显式临时
bypass，不得作为 release evidence。

### Hook 2：PostToolUse — 写入后复验

**目标：** 对已经完成的 Write / Edit 重新执行 workspace containment、路径组件、
目标类型、hard-link 和受保护 `hooks.json` 内容检查。失败时以 exit 2 和
high-severity 信息停止后续 workflow。PostToolUse 发生在实际操作之后，因此该
复验不能回滚写入；它用于发现 preflight 与实际写入之间的路径替换或结果漂移。

**Active implementation:** `nova-plugin/hooks/scripts/post-write-verify.mjs`

### Hook 3：PostToolUse — 审计日志

**目标：** 记录所有 Write / Edit / NotebookEdit / Bash 操作的审计日志，格式：

```
[2026-03-18T07:00:00Z] Write /path/to/file.ts SUCCESS
[2026-03-18T07:00:01Z] Bash  node scripts/validate-schemas.mjs SUCCESS
```

事件先原子写入 `${CLAUDE_PLUGIN_DATA}/audit-spool/`，再由独立 compactor 在
跨进程目录锁下汇总到 `audit.log`（本地，不提交 git）。日志位置、权限、轮转、
health 事件、路径哈希与 best-effort redaction 边界见
[`docs/privacy/data-handling.md`](../../../docs/privacy/data-handling.md)。

**Active launcher:** exec-form `node`

**Active implementation:** `nova-plugin/hooks/scripts/post-audit-log.mjs`

---

## 文件结构

```
nova-plugin/hooks/
├── hooks.json                    ← hook 主配置
└── scripts/
    ├── pre-write-check.sh        ← fail-closed Bash 启动器
    ├── pre-write-check.mjs       ← active Node PreToolUse 实现
    ├── pre-bash-check.sh         ← fail-closed Bash scope launcher
    ├── pre-bash-check.mjs        ← scoped Bash command policy
    ├── post-write-verify.mjs     ← synchronous actual-path/content verifier
    ├── audit-compactor.mjs       ← lock-protected spool compactor and rotation owner
    ├── post-audit-log.sh         ← compatibility and syntax-test helper; not active in hooks.json
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

`hooks.json` 对 post-use audit 使用 exec form 直接调用 Node.js 22+，对 PreToolUse 保留 Bash fail-closed launcher。Windows 在写入 guard 和运行 Codex helpers 时需要 Git
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
| `NOVA_EXPLICIT_ARTIFACT_ROOT` / `NOVA_EXPLICIT_ARTIFACT_ROOTS` | 显式批准的 project 外 artifact root；多值形式使用平台 path delimiter |
| `NOVA_AUDIT_DISABLED=1` | 禁用本地 audit log |

## 安全边界

PreToolUse 的 Bash matcher 会阻止常见的重定向、compound command 和直接 mutator，
但无法证明允许脚本的内部副作用，也无法替代 OS sandbox。PreToolUse 与 PostToolUse
之间仍存在 TOCTOU 时间窗，且 PostToolUse 不能撤销已经完成的操作。该 hook 是
guardrail，不是 sandbox；剩余 Bash 风险仍依赖 Claude 权限、sandbox、CI secret
scan 和 release gate。

---

## 扩展计划

以下事项从 `2.1.0` 起一直是未排期候选，在当前 `3.1.0` 中仍未发布，
也不作为下一版本承诺。

| 状态 | 计划 |
|------|------|
| Deferred | 实现 Stop Hook：在 finalize 命令后校验 CHANGELOG 已更新 |
| Deferred | 实现 Notification Hook：`permission_prompt` 时记录危险操作请求 |
| Deferred | HTTP Hook：将审计日志推送到本地 webhook（可选） |

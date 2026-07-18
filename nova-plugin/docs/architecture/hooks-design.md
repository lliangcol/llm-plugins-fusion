# Hooks 设计文档

<!-- generated:project-state:start -->
## Current Machine-Derived Project Facts

Do not edit this block by hand. It is synchronized by
`node scripts/generate-project-state.mjs --write` from repository domain
sources and `governance/product-lanes.json`.

- Plugin: `nova-plugin@4.1.0`; production plugins: 1; public path: `nova-plugin/`
- Runtime: Node.js `>=22`; distributed Bash helpers: `3.2+`
- Inventory: 21 commands, 6 skills, 6 active agents, 8 capability packs
- Workflow contract: schema v5, namespace `nova-plugin`, 21 workflows
- Evaluation datasets: `live-paired` has 168 cases and 2016 planned paired invocations; `real-task-benchmark` has 24 tasks and 432 planned invocations
- Package scripts: `check` is present; `build` is absent
- Active product lanes: `workflow-framework`, `single-plugin-delivery`, `release-candidate-promotion`, `live-assistant-evaluation`, `generic-framework-kernel`
- Planned product lanes: None
- Deferred product lanes: `production-multi-plugin-layout`, `public-portal`, `runtime-dynamic-loading`, `broad-domain-command-expansion`
- Release model: `candidate-and-promotion`
- Active PreToolUse launcher: `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh`, `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-bash-check.sh`
- Active PostToolUse launcher: `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/trusted-node-hook.sh post-write-verify`, `bash -p ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/trusted-node-hook.sh post-audit-log`
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
            "command": "bash",
            "args": ["-p", "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh"],
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
| 事件 | `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionDenied`, `ConfigChange`, `SessionEnd` |
| Entry 字段 | `matcher`, `hooks` |
| Hook 类型 | `type: "command"` |
| Hook 字段 | `type`, `command`, `args`, `timeout`, `statusMessage`, `async` |
| Shell 调用 | `.sh` 脚本必须通过 exec-form `bash -p` + 脚本路径参数调用；`-p` 必须位于脚本路径之前 |
| Active runtime | Node.js 22+ `.mjs` files own hook business logic; every active Node hook uses a fail-closed `bash -p` exec-form launcher that resolves a trusted Node identity outside the project before startup. |

`Stop`、`Notification`、非 command hook 类型、额外字段或其它 Claude Code
未来 schema 字段必须先补 fixture、脚本行为和文档，再放开校验。不要为了兼容
未知字段而把校验器改成 pass-through。

Claude Code exec form 会在任何插件代码运行前，从宿主 `PATH` 解析最初的 bare
`bash`，并可能先应用 project/local settings。因此这个 Bash 以及启动 settings
都是显式的宿主信任根，launcher 无法在自身启动后追溯证明它们。
`doctor` 与 `validate:bootstrap` 会在 `PATH` 含空、相对或 project-owned entry、
`bash` 解析到可写 project 内，或当前 checkout settings 含 `disableAllHooks`/信任环境
注入时失败。需要在首个 plugin hook 前组织级强制此边界时，必须使用 managed policy
和 managed-enabled plugin。Write guard 同时冻结 project
`.claude/settings.json`、`.claude/settings.local.json`、任意 project
`bash`/`bash.exe`、所有 `.git` 元数据，以及分发的 `hooks/scripts/**` +
`runtime/**` 实现闭包；`ConfigChange` 还会阻止 project/local settings 在已保护会话
中生效。已经从受污染宿主 `PATH` 或 settings 启动的会话不在安全声明内；必须先修复
宿主配置并重启 Claude Code。

### Hook 1：PreToolUse — 写入前检查

**目标：** 在 Write / Edit / NotebookEdit 操作前检查以下规则：

| 检查项 | 规则 | 处理 |
|--------|------|------|
| 敏感信息检测 | 内容含 `password|secret|token|api_key`（硬编码模式）| exit 2 阻断 |
| payload/runtime 校验 | Node 缺失、payload 非法或 Edit 无法可靠重构 | exit 2 阻断 |
| 路径封闭 | 目标不在 project/显式 artifact root、父路径经 symlink/junction 跳转，或 artifact root 覆盖 PATH/project 祖先/隐藏宿主控制目录 | exit 2 阻断 |
| 目标类型检查 | 已存在的 Write/Edit 目标是符号链接、非普通文件，或 `nlink !== 1`（含无法可靠读取 link count） | exit 2 阻断 |
| Agent 控制面 | project 内任意层级的 `.git` 文件或 `.git/**` 元数据（包括 config、hooks 与 worktree 指针） | exit 2 阻断 |
| 内容大小 | Write 或重构后的 Edit 内容超过 10 MiB | exit 2 阻断 |
| NotebookEdit | 无法从 payload 可靠重构完整 notebook proposed content | exit 2 阻断 |
| hooks.json 结构校验 | 仅对 project/plugin 的受保护 hooks 配置验证 JSON/schema；无关的 `config/hooks.json` 不套用 nova schema | exit 2 阻断 |

**Active launcher:** exec-form `bash -p` + `nova-plugin/hooks/scripts/pre-write-check.sh`

**Active implementation:** `nova-plugin/hooks/scripts/pre-write-check.mjs`

### Hook 1B：PreToolUse — scoped Bash guard

**目标：** 在正常 Bash 权限提示之前执行默认拒绝的 validation command broker。
分发策略仅允许只读 Git、`rg`、`bash -n`、ShellCheck 和版本探测；项目验证器必须
在仓库自己的 `.nova/shell-policy.json` 中按完整 argv 精确登记。组合命令、重定向、
变量/命令替换、未登记解释器与包执行器一律拒绝。允许结果仍要经过 Claude 权限提示
和外部 sandbox；项目策略是仓库审查面，不等于预授权。
项目根优先取 `CLAUDE_PROJECT_DIR`，事件 `cwd` 只表示实际命令目录且必须位于该项目根
内；项目策略查找、session policy pin 和 PATH shadow containment 始终绑定项目根，
因此从仓库子目录调用不会缩小安全边界。PATH 搜索按实际可执行权限跳过不可执行文件，
并拒绝与命令同名的已导出 `BASH_FUNC_<command>%%` 函数覆盖。两个 Bash launcher
固定使用 Bash 3.2+ 的 `-p` privileged mode，使 `BASH_ENV`、`ENV` 和导出函数无法在
脚本首行前加载；launcher 与 Node broker 仍会防御性拒绝继承的 startup-file 变量。
两个 launcher 还会在 Node 版本探测或 exec 之前拒绝任何已设置的 `NODE_OPTIONS`；
Node 进程内再检查该变量已经晚于 `--require`/`--import` preload，不能建立启动完整性。
Node broker 另按实际 executable 拒绝可改变只读 argv 语义或启动外部程序的环境变量：
Git 拒绝任意 `GIT_*` 和 `PAGER`；ripgrep 拒绝 `RIPGREP_CONFIG_PATH`。Git 的环境
API 广泛且会演进，完整 namespace fail-closed 可防止通过未枚举变量（例如
`GIT_CONFIG_PARAMETERS` 注入 `diff.external`）绕过只读 argv 策略。变量即使为空，只要存在也
失败关闭。
唯一兼容例外是宿主为非交互执行预设的精确 `GIT_PAGER=cat` 或 `PAGER=cat`：broker
会再次解析 `cat` 的 PATH/realpath 身份，要求它位于项目外，并拒绝导出的
`BASH_FUNC_cat%%` 覆盖。任何其他 pager 值仍失败关闭。

**Active launcher:** exec-form `bash -p` + `nova-plugin/hooks/scripts/pre-bash-check.sh`

**Active implementation:** `nova-plugin/hooks/scripts/pre-bash-check.mjs`

**Distributed policy:** `nova-plugin/runtime/shell-command-policy.json`

**Project exact policy:** `.nova/shell-policy.json`

敏感信息检测规则由 `nova-plugin/runtime/secret-rules.mjs` 统一维护。Bash
启动器只解析 Node 路径；Node 缺失时 fail closed。
`NOVA_WRITE_GUARD_DISABLED=1` 已废弃并会直接 exit 2，不再提供环境 bypass。

### Hook 1C：ConfigChange — 会话配置冻结

**目标：** 对 `project_settings|local_settings` 的会话中变更一律 exit 2，阻止新配置
应用到当前会话。文件本身可能已由外部编辑器改变，因此操作员应审查文件并在
startup trust preflight 通过后重启。首个 hook 运行前已经存在的设置仍属于宿主信任
边界，只有 managed policy 能组织级强制。

**Active launcher:** exec-form `bash -p` + `nova-plugin/hooks/scripts/trusted-node-hook.sh config-change-guard`

**Active implementation:** `nova-plugin/hooks/scripts/config-change-guard.mjs`

### Hook 2：PostToolUse — 写入后复验

**目标：** 对已经完成的 Write / Edit 重新执行 workspace containment、路径组件、
目标类型、hard-link、受保护的 `.git` 元数据和 `hooks.json` 内容检查。失败时以 exit 2 和
high-severity 信息停止后续 workflow。PostToolUse 发生在实际操作之后，因此该
复验不能回滚写入；它用于发现 preflight 与实际写入之间的路径替换或结果漂移。

**Active launcher:** exec-form `bash -p` + `nova-plugin/hooks/scripts/trusted-node-hook.sh post-write-verify`

**Active implementation:** `nova-plugin/hooks/scripts/post-write-verify.mjs`

### Hook 3：PostToolUse — 审计日志

**目标：** 记录所有 Write / Edit / NotebookEdit / Bash 操作的审计日志，格式：

```
[2026-03-18T07:00:00Z] Write /path/to/file.ts SUCCESS
[2026-03-18T07:00:01Z] Bash  node scripts/validate-schemas.mjs SUCCESS
```

事件只原子写入 `${CLAUDE_PLUGIN_DATA}/audit-spool/`；达到 50 条或 1 MiB 时
异步触发独立 compactor，并在 `SessionEnd` 做最终 compact。compactor 在跨进程
目录锁下汇总到 `audit.log`（本地，不提交 git）。目录使用 `0700`，health、lock、
spool 和 log 文件使用 `0600`。审计目录已有的父路径组件与最终目录必须是真实目录；
log、lock owner 与 spool 记录必须是单硬链接普通文件，否则在追加、汇总或删除前失败关闭。日志位置、权限、轮转、
health 事件、路径哈希与 best-effort redaction 边界见
[`docs/reference/security/data-handling.md`](../../../docs/reference/security/data-handling.md)。

PostToolUse、PostToolUseFailure、PermissionDenied 和 SessionEnd 共用
`trusted-node-hook.sh`。该 launcher 在任何 Node probe/preload 前拒绝 `BASH_ENV`、
`ENV`、`NODE_OPTIONS` 和导出函数，只接受三个固定 hook id，并通过
`nova_node_command "$CLAUDE_PROJECT_DIR"` 拒绝项目内、相对或空 PATH entry 的 Node
shadow。SessionEnd 的 `audit-compactor` 也走同一信任链。

**Active launcher:** exec-form `bash -p` + `nova-plugin/hooks/scripts/trusted-node-hook.sh post-audit-log`

**Active implementation:** `nova-plugin/hooks/scripts/post-audit-log.mjs`

---

## 文件结构

```
nova-plugin/hooks/
├── hooks.json                    ← hook 主配置
└── scripts/
    ├── pre-write-check.sh        ← active fail-closed PreToolUse launcher
    ├── pre-write-check.mjs       ← active Node PreToolUse 实现
    ├── pre-bash-check.sh         ← active fail-closed Bash broker launcher
    ├── pre-bash-check.mjs        ← scoped Bash command policy
    ├── trusted-node-hook.sh      ← active trusted Node launcher for post/session hooks
    ├── config-change-guard.mjs   ← blocks project/local settings activation mid-session
    ├── post-write-verify.mjs     ← synchronous actual-path/content verifier
    ├── audit-compactor.mjs       ← lock-protected spool compactor and rotation owner
    ├── post-audit-log.sh         ← compatibility helper; not active in hooks.json
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

`hooks.json` 的所有 active Node hook 都先通过 exec-form `bash -p` launcher，再调用
经物理路径验证且位于 project 外的 Node.js 22+。因此 Windows 运行 active hooks
需要 Git Bash、WSL 或其他 Bash 3.2+ 兼容运行时。缺少可信 Bash/Node 时 hook
fail closed；PostToolUse 发生在写入之后，阻断只能停止后续 workflow，不能回滚写入。

---

## 环境变量

脚本中可用的路径变量：

| 变量 | 含义 |
|------|------|
| `$CLAUDE_PROJECT_DIR` | 项目根目录 |
| `${CLAUDE_PLUGIN_ROOT}` | 插件目录（`nova-plugin/`） |
| `${CLAUDE_PLUGIN_DATA}` | 插件数据目录（持久存储，不在项目内） |
| `NOVA_WRITE_GUARD_DISABLED=1` | 已废弃；fail-closed launcher 会拒绝该值 |
| `NOVA_EXPLICIT_ARTIFACT_ROOT` / `NOVA_EXPLICIT_ARTIFACT_ROOTS` | 显式批准的专用 project 外 artifact root；不得覆盖 PATH、project 祖先或隐藏宿主控制目录；多值形式使用平台 path delimiter |
| `NOVA_AUDIT_DISABLED=1` | 禁用本地 audit log |

## 安全边界

PreToolUse 的 Bash matcher 会阻止常见的重定向、compound command 和直接 mutator，
但无法证明允许脚本的内部副作用，也无法替代 OS sandbox。PreToolUse 与 PostToolUse
之间仍存在 TOCTOU 时间窗，且 PostToolUse 不能撤销已经完成的操作。该 hook 是
guardrail，不是 sandbox；剩余 Bash 风险仍依赖 Claude 权限、sandbox、CI secret
scan 和 release gate。

---

## 扩展计划

以下事项从 `2.1.0` 起一直是未排期候选，在当前 `4.0.0` 中仍未发布，
也不作为下一版本承诺。

| 状态 | 计划 |
|------|------|
| Deferred | 实现 Stop Hook：在 finalize 命令后校验 CHANGELOG 已更新 |
| Deferred | 实现 Notification Hook：`permission_prompt` 时记录危险操作请求 |
| Deferred | HTTP Hook：将审计日志推送到本地 webhook（可选） |

# Skill-first 设计说明：Commands 与 Skills

## 为什么还有两份文件？

`nova-plugin` 仍为每个能力维护两种入口：

- `nova-plugin/commands/*.md`：面向用户的 slash command 入口和兼容 API。
- `nova-plugin/skills/nova-*/SKILL.md`：行为事实源，承载参数解析、安全边界、输出契约和工作流。

本仓库当前采用 **direct command + compatibility skill + shared policy**。
Command 直接执行 workflow，并同时读取生成的 runtime JSON 作为机器权限/输入摘要、
对应 `SKILL.md` 作为完整行为契约；它不再通过 Skill tool 或 frontmatter 运行时委派。
任一合同缺失或两者冲突时必须 fail closed。

---

## Commands：稳定 slash 入口

**位置：** `nova-plugin/commands/*.md`

Command 文件必须保留：

- `id`
- `stage`
- `title`
- `description`
- `destructive-actions`
- `allowed-tools`
- `disallowed-tools`
- `user-invocable`
- `disable-model-invocation`

正文保持薄包装，例如：

```md
Execute this workflow directly from `$ARGUMENTS`.

Read `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/<id>.json` as the machine policy
summary and `${CLAUDE_PLUGIN_ROOT}/skills/nova-<id>/SKILL.md` as the
authoritative behavioral contract. Do not invoke it through the Skill tool;
fail closed on missing or conflicting contracts.
```

Command 的职责是：

- 保留用户熟悉的 slash command 名称。
- 保持旧入口兼容，例如 `/nova-plugin:explore-lite`、`/nova-plugin:review-only`、`/nova-plugin:finalize-lite`。
- 暴露 Claude command `description`，帮助命令菜单和发现。
- 直接应用对应 `SKILL.md` 的参数、安全、输出和失败契约，不做运行时委派。

---

## Skills：行为事实源

**位置：** `nova-plugin/skills/nova-*/SKILL.md`

每个 skill 必须包含标准章节：

```md
## Inputs
## Parameter Resolution
## Safety Preflight
## Outputs
## Workflow
## Failure Modes
## Examples
```

Skill 的职责是：

- 定义输入参数、默认值、别名和 safety-boundary 参数。
- 说明何时需要 preflight，以及哪些文件、脚本或 artifact 可能被写入。
- 保留从旧 command 迁移来的详细行为契约。
- 引用 `_shared` 通用策略，避免参数、安全和输出规则在 21 个 skill 中漂移。

---

## Shared policies

通用策略位于 `nova-plugin/skills/_shared/`：

- `parameter-resolution.md`
- `safety-preflight.md`
- `output-contracts.md`
- `artifact-policy.md`
- `agent-routing.md`

每个 skill 内联关键规则摘要，同时引用共享文件作为详细事实源。这样即使模型没有预先读取共享文件，单个 skill 仍然保留最低限度的可执行约束。

---

## 两者关系

```text
用户触发 slash command
        |
        v
commands/<id>.md
  thin wrapper + frontmatter
        |
        v
runtime/contracts/<id>.json
  machine policy summary
        |
        v
skills/nova-<id>/SKILL.md
  behavior source of truth
        |
        v
skills/_shared/*.md
  reusable policy details
```

Commands 与 skills 必须保持一对一：

```text
nova-plugin/commands/<id>.md
nova-plugin/skills/nova-<id>/SKILL.md
```

---

## 维护规范

修改命令或 skill 时：

1. 更新 `nova-plugin/commands/<id>.md` 的 frontmatter 和薄包装语义。
2. 更新 `nova-plugin/skills/nova-<id>/SKILL.md` 的输入、preflight、输出和 workflow。
3. 若变更通用参数、安全、artifact 或 agent routing 规则，更新 `_shared`。
4. 若用户可见行为变化，更新 README、CHANGELOG、相关 command docs 和 skills README。
5. 运行 `node scripts/lint-frontmatter.mjs`。

若修改 metadata 或 marketplace：

```bash
node scripts/validate-schemas.mjs
claude plugin validate nova-plugin
```

若修改 hooks：

```bash
node scripts/validate-hooks.mjs
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/pre-bash-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

Windows PowerShell 环境需要 Git Bash、WSL，或其他可用的 Bash 运行时才能执行 `bash -n` 和 plugin hooks。

---

## 为什么不合并为一份？

| 需求 | Commands | Skills |
| --- | --- | --- |
| 稳定 slash command UX | ✅ | 间接 |
| 旧命令名兼容 | ✅ | 间接 |
| Claude skill discovery | 间接 | ✅ |
| 参数/安全/输出事实源 | 薄入口 | ✅ |
| 共享策略复用 | 引用入口 | ✅ |
| lint 防漂移 | ✅ | ✅ |

当前设计避免在 command 与 skill 中维护两份长 prompt。Command 稳定入口，skill 承载行为，`_shared` 承载跨 skill 的通用规则。

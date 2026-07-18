# Skill-first 设计说明：21 个 Commands 与 6 个 Skills

## 两种入口，一个行为事实源

`nova-plugin` 对外保留 21 个稳定 slash command 入口，但只有 6 个
canonical Skills 拥有行为：

- `nova-plugin/commands/*.md`：21 个由生成器维护的 command wrappers。
- `nova-plugin/skills/nova-*/SKILL.md`：6 个 canonical Skills，承载输入、
  参数解析、安全边界、输出与 workflow 解释。
- `nova-plugin/runtime/contracts/*.json`：由同一 typed IR 生成的机器可读
  权限、输入与效果摘要。

6 个 canonical 命令直接选择同名 Skill；其余 15 个兼容别名选择某个
canonical Skill 并附加固定 variant preset。兼容别名不拥有单独的
`SKILL.md`，也不复制行为。完整映射见
[`nova-plugin/skills/README.md`](../../skills/README.md)。

---

## 作者源与生成链

人工编辑的 workflow 事实源是：

- `workflow-specs/workflows.json`：身份、输入、owner、权限、effect 与
  surface metadata。
- `workflow-specs/behaviors.json`：decision、step、invariant、stop、
  output 与 failure behavior。
- `workflow-specs/nova.product.json`、`workflow-specs/adapters/*.json` 与
  `governance/workflow-docs.json`：各自拥有的产品、adapter 与 command-doc
  metadata。

投影链为：

```text
workflow-specs/workflows.json + workflow-specs/behaviors.json
  + product / adapter / command-doc metadata
        |
        v
workflow-specs/workflows.v6.json + workflow-specs/behaviors.v2.json
        |
        +--> nova-plugin/runtime/contracts/<command-id>.json
        +--> nova-plugin/skills/nova-<canonical-surface>/SKILL.md generated block
        +--> nova-plugin/commands/<command-id>.md
        `--> nova-plugin/docs/commands/** generated contract blocks
```

`workflows.v6.json`、`behaviors.v2.json`、command wrappers、Skill frontmatter 与
Skill generated behavior blocks 都是生成产物，不要手工编辑。

---

## Commands：稳定 slash 入口

**位置：** `nova-plugin/commands/*.md`

Command wrapper 保留用户可见的 id、stage、description、tool/risk metadata 和
兼容命令名。生成的正文只做三件事：

1. 读取对应的 runtime contract。
2. 读取所选 canonical Skill。
3. 将固定 variant preset 与用户显式、不冲突的参数合并。

例如：

```text
codex-review-only
  -> runtime/contracts/codex-review-only.json
  -> skills/nova-review/SKILL.md
  -> REVIEW_PROFILE=codex-review-only
```

Command 不复制 Skill 的详细 prompt，也不通过历史 `invokes` frontmatter
运行时委派。任一 contract 缺失或冲突时必须 fail closed。

---

## Skills：行为事实源

**位置：** 6 个 `nova-plugin/skills/nova-<canonical-surface>/SKILL.md`

Canonical Skill 必须保留可执行的输入、安全、输出、步骤和失败语义。
生成器拥有 frontmatter 和 behavior block；维护者只能在生成区域之外编辑
解释性 prose，且不能与 typed contract 冲突。

共享策略位于 `nova-plugin/skills/_shared/`：

- `parameter-resolution.md`
- `safety-preflight.md`
- `output-contracts.md`
- `artifact-policy.md`
- `agent-routing.md`

---

## 21 到 6 的映射

```text
21 command ids
        |
        | canonical surface + optional fixed preset
        v
6 canonical Skills
        |
        v
shared policy + generated runtime contract
```

Canonical Skills 是 `nova-route`、`nova-explore`、`nova-produce-plan`、
`nova-review`、`nova-implement-plan` 和 `nova-finalize-work`。别名与 Skill
是多对一，不是一对一。

---

## 维护规范

修改 workflow surface 时：

1. 在 `workflow-specs/workflows.json`、`workflow-specs/behaviors.json` 或对应
   owned metadata 中修改事实源。
2. 生成 typed IR，不要手工编辑 v6/v2 文件：

   ```bash
   node scripts/migrate-v6-contracts.mjs --write
   ```

3. 生成所有投影：

   ```bash
   node scripts/generate-workflow-permissions.mjs --write
   node scripts/generate-runtime-contracts.mjs --write
   node scripts/generate-behavior-surfaces.mjs --write
   node scripts/generate-adapters.mjs --write
   node scripts/generate-command-docs.mjs --write
   ```

4. 仅在确有需要时修改 canonical Skill 生成区块之外的 prose、
   `nova-plugin/skills/README.md` 和用户文档。
5. 运行 `node scripts/lint-frontmatter.mjs`、对应的投影无漂移检查与
   `node scripts/validate-all.mjs`。

若修改 hooks：

```bash
node scripts/validate-hooks.mjs
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/pre-bash-check.sh
bash -n nova-plugin/hooks/scripts/trusted-node-hook.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
node scripts/validate-runtime-smoke.mjs
```

Windows PowerShell 环境需要 Git Bash、WSL 或其他可用 Bash 运行时才能执行
`bash -n` 和 plugin hooks；未实际运行的 Bash 检查必须记录为 skipped。

---

## 为什么保留 Commands？

| 需求 | Commands | Canonical Skills |
| --- | --- | --- |
| 稳定 slash command UX | ✅ | 间接 |
| 15 个历史别名兼容 | ✅ | 通过 preset 复用 |
| Claude Skill discovery | 间接 | ✅ |
| 参数/安全/输出行为事实源 | 生成的薄入口 | ✅ |
| 共享策略复用 | 通过所选 Skill | ✅ |

这一设计保留 21 个稳定入口，同时将行为维护面收敛到 6 个
canonical Skills 和一套 typed authoring sources。

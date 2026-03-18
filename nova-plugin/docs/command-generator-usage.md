# nova-plugin-command-generator 使用说明

## 工具定位

`nova-plugin-command-generator` 是一个**离线命令构建助手**，帮助你可视化地配置 nova-plugin 的命令参数，生成可直接粘贴到 Claude Code 中使用的完整指令文本。

它不替代 nova-plugin 本身，而是作为辅助工具降低手动构建命令的门槛。

---

## 启动方式

```bash
cd nova-plugin-command-generator
npm install
npm run dev
```

启动后访问 [http://localhost:5173](http://localhost:5173)。

---

## 使用流程

1. **选择场景**（Scenes 标签页）
   - 根据你的当前任务类型（如"探索代码库"、"实现新功能"、"代码评审"等）选择场景
   - 工具会推荐适合该场景的命令

2. **选择命令**（Commands 标签页）
   - 浏览所有 17 个 nova-plugin 命令（按阶段分组：Explore / Plan / Review / Implement / Finalize）
   - 点击命令查看详情与所需参数

3. **填写参数**（Generator 标签页）
   - 按提示填写 INTENT（意图）、CONTEXT（上下文）、CONSTRAINTS（约束）等字段
   - 工具会实时评估填写质量并给出建议
   - 支持附件上传（最大 200KB）

4. **复制输出**
   - 点击"复制"按钮获取生成的完整命令文本

5. **粘贴到 Claude Code**
   - 将复制内容直接粘贴到 Claude Code 对话框中执行

---

## 引导流程（Guidance）

工具内置五阶段引导系统，追踪你的工作进度：

```
Explore → Plan → Review → Implement → Finalize
```

每完成一个阶段的命令执行，工具会自动推荐下一步最合适的命令，帮助你按照结构化流程推进项目。

---

## 与 nova-plugin 的关系

| 组件 | 作用 |
|------|------|
| `nova-plugin/commands/*.md` | 命令的完整定义（prompt 内容），Claude Code 直接执行 |
| `nova-plugin/skills/nova-*/` | 结构化技能元数据，供 orchestrator agent 调用 |
| `nova-plugin-command-generator` | 可视化参数构建工具，辅助生成命令文本，**不直接执行命令** |

命令生成器读取 `src/data/manifest.ts` 中的命令定义（与 `commands/*.md` 保持同步），生成的文本最终由你手动粘贴给 Claude Code 执行。

---

## 开发命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 生产构建
npm run lint         # ESLint 检查（零警告）
npm run test         # 运行 Vitest 测试
npm run preview      # 预览生产构建
```

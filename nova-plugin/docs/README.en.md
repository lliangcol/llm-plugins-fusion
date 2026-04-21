English | [中文](../../README.md)

<div align="center">

# LLM Plugins Fusion

**A third-party LLM plugin marketplace + plugin collection**

[![Version](https://img.shields.io/badge/version-1.0.7-blue.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com)

</div>

---

## 📖 Overview

**LLM Plugins Fusion** is a third-party marketplace and curated plugin collection for LLM coding assistants (e.g., Claude Code). With this repo you can:

- 🎯 **One-command install**: quickly integrate plugins into Claude Code
- 🔧 **Workflow-first**: command presets covering a full engineering workflow
- 📚 **Solid docs**: practical handbooks and examples
- 🔄 **Easy to extend**: add new plugins and capabilities over time

---

## 🚀 Quick start

### Step 1: Add the marketplace

Run in Claude Code:

```bash
/plugin marketplace add lliangcol/llm-plugins-fusion
```

### Step 2: Install the plugin

```bash
/plugin install nova-plugin@llm-plugins-fusion
```

### Step 3: Start using it

```bash
# Show installed plugins
/plugin

# Use a command
/senior-explore analyze the current project
```

---

## 📁 Repository structure

```
llm-plugins-fusion/
├── 📄 .claude-plugin/
│   └── marketplace.json              # marketplace entry
├── 📦 nova-plugin/                    # plugin
│   ├── 📄 .claude-plugin/
│   │   └── plugin.json               # plugin metadata
│   ├── 📂 commands/                   # 20 command presets (17 existing + 3 Codex loop commands)
│   │   ├── senior-explore.md
│   │   ├── ⭐ explore.md          # Unified exploration command (new)
│   │   ├── explore-lite.md
│   │   ├── explore-review.md
│   │   ├── plan-lite.md
│   │   ├── produce-plan.md
│   │   ├── backend-plan.md
│   │   ├── plan-review.md
│   │   ├── review-lite.md
│   │   ├── ⭐ review.md           # Unified review command (new)
│   │   ├── review-only.md
│   │   ├── review-strict.md
│   │   ├── codex-review-only.md
│   │   ├── codex-verify-only.md
│   │   ├── implement-plan.md
│   │   ├── implement-standard.md
│   │   ├── implement-lite.md
│   │   ├── codex-review-fix.md
│   │   ├── finalize-work.md
│   │   └── finalize-lite.md
│   ├── 📂 docs/                       # docs
│   │   ├── commands-reference-guide.md
│   │   ├── claude-code-commands-handbook.md
│   │   ├── agents-summary.md
│   │   └── agents-summary.en.md
│   ├── 📂 hooks/                      # hooks config
│   ├── 📂 agents/                     # sub-agent definitions
│   ├── 📂 config/                     # config files
│   ├── 📂 output-styles/              # output styles
│   ├── 📂 scripts/                    # scripts
│   └── 📂 skills/                     # skills
└── 📄 README.md                       # Chinese README
```

---

## 🔌 Plugin: `nova-plugin`

<table>
<tr>
<td width="120"><strong>Version</strong></td>
<td>1.0.7</td>
</tr>
<tr>
<td><strong>Author</strong></td>
<td>liu liang</td>
</tr>
<tr>
<td><strong>Commands</strong></td>
<td>20 (17 existing + 3 Codex loop commands)</td>
</tr>
<tr>
<td><strong>Positioning</strong></td>
<td>Developer productivity workflow plugin</td>
</tr>
</table>

### 🎯 Core capabilities

A developer-productivity plugin for LLM coding assistants (Claude Code compatible), covering an end-to-end engineering workflow plus a semi-automated Codex review/fix/verify loop.

### Workflow stages

| Stage    | Explore 🔍             | Plan 📝        | Review 🔎                     | Implement ⚙️                | Finalize 📦      |
| -------- | ---------------------- | -------------- | ----------------------------- | --------------------------- | ---------------- |
| Goal     | Understand the problem | Draft the plan | Review quality / Codex verify | Write code / Codex fix loop | Deliver outcomes |
| Commands | 4 commands             | 4 commands     | 6 commands                    | 4 commands                  | 2 commands       |
| Unified  | ⭐ `/explore`          | -              | ⭐ `/review` + Codex variants  | `/codex-review-fix`         | -                |

---

## 🧠 Agents

Active agents: 14 (default-scanned: `nova-plugin/agents/`). Legacy agents: 69 (archived: `.claude/agents/archive/nova-plugin/agents/`; manifest: `docs/agents/MIGRATION_MANIFEST.md`).

- Routing & usage: `docs/agents/ROUTING.md`
- Legacy summaries (kept for reference): `nova-plugin/docs/agents-summary.md` / `nova-plugin/docs/agents-summary.en.md`

---

## 📚 Documentation

| 📄 Document                                                                | 📝 Description                                    | 🎯 Use cases                     |
| -------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------- |
| [📘 Command Reference Guide](nova-plugin/docs/commands-reference-guide.md) | Full parameters, 5+ scenarios, workflow templates | **Daily lookup, copy templates** |
| [📗 Command Handbook](nova-plugin/docs/claude-code-commands-handbook.md)   | Grouped by type, command comparison               | **Quick start, pick a command**  |
| [🧩 Codex Loop Guide](nova-plugin/docs/codex-review-fix.README.md)         | review/fix/verify skills + scripts                | **Claude Code + Codex loop**     |
| [🧭 Agents Routing](docs/agents/ROUTING.md)                                | Active agents, keyword routing, examples          | **Auto routing, pick agents**    |
| [🧠 Agents Summary](nova-plugin/docs/agents-summary.en.md)                 | Agent roles, tools, and scenarios                 | **Understand and pick agents**   |

For the Chinese version, see `README.md` and `nova-plugin/docs/agents-summary.md`.

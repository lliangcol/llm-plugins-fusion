English | [中文](../../README.md)

<div align="center">

# Claude Plugins Fusion

**A Claude Code plugin marketplace + plugin collection**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-purple.svg)](https://claude.ai)

</div>

---

## 📖 Overview

**Claude Plugins Fusion** is a repo for managing a Claude Code plugin marketplace and curated plugin collection. With this repo you can:

- 🎯 **One-command install** — quickly integrate plugins into Claude Code
- 🔧 **Workflow-first** — command presets that cover a full engineering workflow
- 📚 **Good documentation** — practical handbooks and copy-paste templates
- 🔄 **Easy to extend** — add new plugins and capabilities over time

---

## 🚀 Quick start

### Step 1: Add the marketplace

Run in Claude Code:

```bash
/plugin marketplace add <github-username>/claude-plugins-fusion
```

### Step 2: Install the plugin

```bash
claude plugin install nova-plugin@claude-plugins-fusion
```

### Step 3: Start using it

```bash
# Show installed plugins
/plugin

# Use a command
/senior-explore analyze the current project
```

> 💡 Tip: once installed, you can use all 15 workflow commands.

---

## 📁 Repository structure

```
claude-plugins-fusion/
│
├── 📄 .claude-plugin/
│   └── marketplace.json              ← marketplace entry
│
├── 📦 nova-plugin/                    ← plugin
│   ├── 📄 .claude-plugin/
│   │   └── plugin.json               ← plugin metadata
│   │
│   ├── 📂 commands/                   ← 15 command presets
│   │   ├── senior-explore.md
│   │   ├── explore-lite.md
│   │   ├── explore-review.md
│   │   ├── plan-lite.md
│   │   ├── produce-plan.md
│   │   ├── backend-plan.md
│   │   ├── plan-review.md
│   │   ├── review-lite.md
│   │   ├── review-only.md
│   │   ├── review-strict.md
│   │   ├── implement-plan.md
│   │   ├── implement-standard.md
│   │   ├── implement-lite.md
│   │   ├── finalize-work.md
│   │   └── finalize-lite.md
│   │
│   ├── 📂 docs/                       ← docs
│   │   ├── README.en.md
│   │   ├── commands-reference-guide.md
│   │   ├── claude-code-commands-handbook.md
│   │   ├── commands-reference-guide.en.md
│   │   └── claude-code-commands-handbook.en.md
│   │
│   ├── 📂 hooks/                      ← hooks config
│   ├── 📂 agents/                     ← agent templates (planned)
│   ├── 📂 config/                     ← config files (planned)
│   ├── 📂 output-styles/              ← output styles (planned)
│   ├── 📂 scripts/                    ← scripts (planned)
│   └── 📂 skills/                     ← skills (planned)
│
└── 📄 README.md                       ← Chinese README
```

---

## 🔌 Plugin: `nova-plugin`

<table>
<tr>
<td width="120"><strong>Version</strong></td>
<td>1.0.0</td>
</tr>
<tr>
<td><strong>Author</strong></td>
<td>liu liang</td>
</tr>
<tr>
<td><strong>Commands</strong></td>
<td>15</td>
</tr>
<tr>
<td><strong>Positioning</strong></td>
<td>Developer productivity workflow plugin</td>
</tr>
</table>

### 🎯 Core capabilities

Designed for Claude Code to enhance engineering productivity across the full workflow.

### Workflow phases

| Phase | Explore 🔍 | Plan 📐 | Review 🔎 | Implement ⚙️ | Finalize 📦 |
|------|--------|--------|--------|--------|--------|
| Goal | Understand | Decide | Verify quality | Write code | Deliver |
| Commands | 3 | 4 | 3 | 3 | 2 |

---

### 📚 Docs navigation (English)

| 📄 Doc | 📝 What it’s for | 🎯 Best used when |
|--------|--------|-----------|
| [📘 Full command reference](./commands-reference-guide.en.md) | Parameters, scenario templates, workflow templates | **Daily lookup, copy/paste templates** |
| [📗 Command handbook](./claude-code-commands-handbook.en.md) | Organized by category, comparison tables | **Getting started, choosing the right command** |

---

### 📋 Command cheat sheet

#### 🔍 Explore — understand only (no solutions)

| Command | Constraint | Description | Definition |
|------|:----:|------|---------|
| `/senior-explore` | 🔴 Strong | Deep analysis; facts/questions/risks | [📄](../commands/senior-explore.md) |
| `/explore-lite` | 🟢 Weak | Quick understanding alignment | [📄](../commands/explore-lite.md) |
| `/explore-review` | 🟡 Medium | Reviewer-style questioning | [📄](../commands/explore-review.md) |

#### 📐 Plan — decide and plan (no code)

| Command | Constraint | Description | Definition |
|------|:----:|------|---------|
| `/plan-lite` | 🟡 Medium | Lightweight execution plan | [📄](../commands/plan-lite.md) |
| `/produce-plan` | 🔴 Strong | Formal design doc (writes file) | [📄](../commands/produce-plan.md) |
| `/backend-plan` | 🔴 Strong | Java/Spring backend design (writes file) | [📄](../commands/backend-plan.md) |
| `/plan-review` | 🟡 Medium | Plan quality review | [📄](../commands/plan-review.md) |

#### 🔎 Review — review only (no code)

| Command | Constraint | Description | Definition |
|------|:----:|------|---------|
| `/review-lite` | 🟢 Weak | Lightweight review for daily PRs | [📄](../commands/review-lite.md) |
| `/review-only` | 🟡 Medium | Standard strict review (by severity) | [📄](../commands/review-only.md) |
| `/review-strict` | 🔴 Strong | Exhaustive audit for high-risk code | [📄](../commands/review-strict.md) |

#### ⚙️ Implement — write code

| Command | Constraint | Description | Definition |
|------|:----:|------|---------|
| `/implement-plan` | 🔴 Strong | Implement strictly by approved plan | [📄](../commands/implement-plan.md) |
| `/implement-standard` | 🟡 Medium | Controlled implementation (small corrections allowed) | [📄](../commands/implement-standard.md) |
| `/implement-lite` | 🟢 Weak | Fast implementation (small refactors allowed) | [📄](../commands/implement-lite.md) |

#### 📦 Finalize — deliver artifacts (no code changes)

| Command | Constraint | Description | Definition |
|------|:----:|------|---------|
| `/finalize-work` | 🔴 Strong | Full delivery output (commit + PR) | [📄](../commands/finalize-work.md) |
| `/finalize-lite` | 🟢 Weak | Minimal summary (3 key points) | [📄](../commands/finalize-lite.md) |

> Legend: 🔴 strong constraints | 🟡 medium | 🟢 weak

---

### 💡 Examples

#### Example 1: New feature development

```bash
# 1️⃣ Explore
/senior-explore
INTENT: Analyze a new feature requirement
CONTEXT: implement user points transfer feature
DEPTH: normal

# 2️⃣ Plan
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/points-transfer.md
PLAN_INTENT: implement points transfer

# 3️⃣ Implement
/implement-plan
PLAN_INPUT_PATH: docs/plans/points-transfer.md
PLAN_APPROVED: true

# 4️⃣ Finalize
/finalize-work
```

#### Example 2: Production issue fix

```bash
# 1️⃣ Investigate
/senior-explore
INTENT: Investigate a production issue
CONTEXT: payment callback duplicated processing
DEPTH: deep

# 2️⃣ Implement a controlled fix
/implement-standard
Follow these steps: ...

# 3️⃣ Strict review (if needed)
/review-strict

# 4️⃣ Finalize
/finalize-work
```

#### Example 3: Daily PR review

```bash
/review-lite    # small changes
/review-only    # core logic
/review-strict  # high-risk code
```

---

## 🛠️ Development guide

### Add a new plugin

```
1. Create a folder       →  <plugin-name>/
2. Add metadata          →  <plugin-name>/.claude-plugin/plugin.json
3. Add content           →  commands/, agents/, skills/, ...
4. Register the plugin   →  add an entry in marketplace.json
```

### Config examples

<details>
<summary>📄 <strong>plugin.json</strong> (click to expand)</summary>

```json
{
  "name": "my-plugin",
  "description": "plugin description",
  "version": "1.0.0",
  "author": {
    "name": "author name"
  }
}
```

</details>

<details>
<summary>📄 <strong>marketplace.json</strong> (click to expand)</summary>

```json
{
  "name": "claude-plugins-fusion",
  "owner": {
    "name": "liu liang"
  },
  "metadata": {
    "description": "A curated marketplace of Claude Code plugins"
  },
  "plugins": [
    {
      "name": "nova-plugin",
      "source": "./nova-plugin",
      "version": "1.0.0",
      "author": {
        "name": "liu liang"
      },
      "description": "Developer productivity workflow plugin"
    }
  ]
}
```

</details>

### Command file format

Command files are **Markdown** under `commands/`:

- Filename is the command name: `review-lite.md` → `/review-lite`
- Supports placeholders: `$ARGUMENTS`, `$PLAN_OUTPUT_PATH`, etc.
- Supports structured input/output definitions

---

## 📖 References

| Resource | Notes |
|-----|------|
| [Claude Code plugin docs](https://code.claude.com/docs/en/discover-plugins) | Official plugin docs |
| [Full command reference](./commands-reference-guide.en.md) | Detailed usage guide |
| [Command handbook](./claude-code-commands-handbook.en.md) | Quick start and comparisons |

---

<div align="center">

**Made with ❤️ for Claude Code**

[🔝 Back to top](#claude-plugins-fusion)

</div>


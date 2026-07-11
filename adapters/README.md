# Assistant Adapters

The canonical workflow definitions live in `workflow-specs/workflows.json`. Adapters translate those definitions without changing their safety or output contracts.

| Adapter | Declared level | Meaning |
| --- | --- | --- |
| Claude Code | L4 | Marketplace install, hooks, permissions, and exact-tag live release gates have automated evidence. |
| Codex | L3 until a live evidence record exists | Generated instructions and capability enforcement contract exist; live evidence is versioned separately. |
| Generic Agent Skills | L1 | Markdown contracts and a machine-readable manifest are parseable; no runtime enforcement is claimed. |

Levels are evidence-based: L1 parseable, L2 invocable, L3 enforced, L4 verified. A missing, stale, or failed live record lowers the evidence for that assistant; documentation alone never upgrades a level.

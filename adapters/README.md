# Assistant Adapters

The canonical workflow definitions live in `workflow-specs/workflows.json`. Adapters translate those definitions without changing their safety or output contracts.

| Adapter | Declared level | Meaning |
| --- | --- | --- |
| Claude Code | L2 declaration, L4 maximum | Marketplace invocation is stable; hooks and exact-tag verification upgrade the effective claim only while digest-bound evidence is current. |
| Codex | L2 declaration, L4 maximum | Generated instructions exist; enforcement and live behavior require current versioned evidence. |
| Generic Agent Skills | L1 | Markdown contracts and a machine-readable manifest are parseable; no runtime enforcement is claimed. |

Levels are evidence-based: L1 parseable, L2 invocable, L3 enforced, L4 verified.
The generated current registry and historical observations are in
`governance/compatibility-evidence.generated.json`; a missing, stale, or failed
record lowers the effective claim automatically.

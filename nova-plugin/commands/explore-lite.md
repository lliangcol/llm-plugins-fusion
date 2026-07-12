---
id: explore-lite
stage: explore
title: /nova-plugin:explore-lite
description: "Quick observer-style exploration for fast understanding alignment without design or implementation."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:explore-lite

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/explore-lite.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-explore/SKILL.md`, then execute canonical surface `nova-explore` with variant preset `{"PERSPECTIVE":"observer","DEPTH":"lite"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: explore
- Owner agents: orchestrator
- Required inputs: `INPUT`
- Output contract: `exploration-lite-v2`
- Risk: none
- Recommended packs: None

If required input, approval, capability, or safety state is unresolved, stop before side effects.

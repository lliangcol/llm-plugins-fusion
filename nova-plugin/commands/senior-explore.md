---
id: senior-explore
stage: explore
title: /nova-plugin:senior-explore
description: "Run deep exploration for complex requirements or incidents, optionally writing an analysis artifact."
destructive-actions: low
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit Bash
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:senior-explore

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/senior-explore.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-explore/SKILL.md`, then execute canonical surface `nova-explore` with variant preset `{"DEPTH":"deep"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: explore
- Owner agents: architect, reviewer
- Required inputs: `INTENT`, `CONTEXT`
- Output contract: `senior-exploration-v2`
- Risk: low
- Recommended packs: None

If required input, approval, capability, or safety state is unresolved, stop before side effects.

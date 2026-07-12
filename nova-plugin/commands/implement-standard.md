---
id: implement-standard
stage: implement
title: /nova-plugin:implement-standard
description: "Execute confirmed implementation steps with controlled scope and validation."
destructive-actions: medium
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:implement-standard

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/implement-standard.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-implement-plan/SKILL.md`, then execute canonical surface `nova-implement-plan` with variant preset `{"EXECUTION_PROFILE":"standard"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: implement
- Owner agents: builder
- Required inputs: `REQUEST`
- Output contract: `implementation-standard-v2`
- Risk: medium
- Recommended packs: None

If required input, approval, capability, or safety state is unresolved, stop before side effects.

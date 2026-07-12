---
id: finalize-lite
stage: finalize
title: /nova-plugin:finalize-lite
description: "Produce a minimal close-out summary of completed work, rationale, and limitations."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:finalize-lite

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/finalize-lite.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-finalize-work/SKILL.md`, then execute canonical surface `nova-finalize-work` with variant preset `{"DEPTH":"lite"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: finalize
- Owner agents: publisher
- Required inputs: `WORK_SUMMARY`
- Output contract: `finalize-lite-v2`
- Risk: none
- Recommended packs: docs

If required input, approval, capability, or safety state is unresolved, stop before side effects.

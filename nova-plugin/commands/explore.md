---
id: explore
stage: explore
title: /nova-plugin:explore
description: "Unified exploration entry that routes observer or reviewer perspectives without modifying code."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:explore

Canonical command wrapper.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/explore.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-explore/SKILL.md`, then execute canonical surface `nova-explore` with variant preset `{}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: explore
- Owner agents: orchestrator, reviewer
- Required inputs: `INPUT`
- Output contract: `exploration-v2`
- Risk: none
- Recommended packs: None

If required input, approval, capability, or safety state is unresolved, stop before side effects.

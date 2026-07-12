---
id: route
stage: explore
title: /nova-plugin:route
description: "Recommend the next nova command, skill, core agent, and capability packs for a request."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:route

Canonical command wrapper.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/route.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-route/SKILL.md`, then execute canonical surface `nova-route` with variant preset `{}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: explore
- Owner agents: orchestrator
- Required inputs: `REQUEST`
- Output contract: `recommended-route-v2`
- Risk: none
- Recommended packs: None

If required input, approval, capability, or safety state is unresolved, stop before side effects.

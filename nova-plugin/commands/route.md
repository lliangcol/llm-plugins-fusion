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

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-route` through the Skill tool.

Before answering, use Read to load `${CLAUDE_PLUGIN_ROOT}/skills/nova-route/SKILL.md` as the supporting behavioral contract, then apply it directly.

- Stage: explore
- Owner agents: orchestrator
- Required inputs: `REQUEST`
- Output contract: `recommended-route-v2`
- Risk: none
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in the supporting contract. If a required input or safety boundary is missing, stop before side effects and report the blocker.

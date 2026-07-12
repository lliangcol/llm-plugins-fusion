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

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-senior-explore` through the Skill tool.

Before answering, use Read to load both `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/senior-explore.json` as the machine-readable policy summary and `${CLAUDE_PLUGIN_ROOT}/skills/nova-senior-explore/SKILL.md` as the authoritative behavioral contract, then execute the workflow directly. If either contract cannot be loaded or they conflict, fail closed and report contract drift.

- Stage: explore
- Owner agents: architect, reviewer
- Required inputs: `INTENT`, `CONTEXT`
- Output contract: `senior-exploration-v2`
- Risk: low
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in both contracts. If a required input or safety boundary is missing, stop before side effects and report the blocker.

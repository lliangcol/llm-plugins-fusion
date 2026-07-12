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

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-implement-standard` through the Skill tool.

Before answering, use Read to load both `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/implement-standard.json` as the machine-readable policy summary and `${CLAUDE_PLUGIN_ROOT}/skills/nova-implement-standard/SKILL.md` as the authoritative behavioral contract, then execute the workflow directly. If either contract cannot be loaded or they conflict, fail closed and report contract drift.

- Stage: implement
- Owner agents: builder
- Required inputs: `REQUEST`
- Output contract: `implementation-standard-v2`
- Risk: medium
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in both contracts. If a required input or safety boundary is missing, stop before side effects and report the blocker.

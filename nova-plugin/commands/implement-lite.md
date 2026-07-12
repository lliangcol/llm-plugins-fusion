---
id: implement-lite
stage: implement
title: /nova-plugin:implement-lite
description: "Make small, bounded implementation changes quickly while respecting existing project conventions."
destructive-actions: medium
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:implement-lite

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-implement-lite` through the Skill tool.

Before answering, use Read to load both `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/implement-lite.json` as the machine-readable policy summary and `${CLAUDE_PLUGIN_ROOT}/skills/nova-implement-lite/SKILL.md` as the authoritative behavioral contract, then execute the workflow directly. If either contract cannot be loaded or they conflict, fail closed and report contract drift.

- Stage: implement
- Owner agents: builder
- Required inputs: `REQUEST`
- Output contract: `implementation-lite-v2`
- Risk: medium
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in both contracts. If a required input or safety boundary is missing, stop before side effects and report the blocker.

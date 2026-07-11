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

Before answering, use Read to load `${CLAUDE_PLUGIN_ROOT}/skills/nova-implement-lite/SKILL.md` as the supporting behavioral contract, then apply it directly.

- Stage: implement
- Owner agents: builder
- Required inputs: `REQUEST`
- Output contract: `implementation-lite-v2`
- Risk: medium
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in the supporting contract. If a required input or safety boundary is missing, stop before side effects and report the blocker.

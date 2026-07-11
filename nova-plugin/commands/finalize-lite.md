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

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-finalize-lite` through the Skill tool.

Before answering, use Read to load `${CLAUDE_PLUGIN_ROOT}/skills/nova-finalize-lite/SKILL.md` as the supporting behavioral contract, then apply it directly.

- Stage: finalize
- Owner agents: publisher
- Required inputs: `WORK_SUMMARY`
- Output contract: `finalize-lite-v2`
- Risk: none
- Recommended packs: docs

Preserve all safety, approval, output, failure, and validation requirements in the supporting contract. If a required input or safety boundary is missing, stop before side effects and report the blocker.

---
id: finalize-work
stage: finalize
title: /nova-plugin:finalize-work
description: "Finalize completed work with handoff, validation, and commit or PR-ready summary text."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:finalize-work

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-finalize-work` through the Skill tool.

Before answering, use Read to load `${CLAUDE_PLUGIN_ROOT}/skills/nova-finalize-work/SKILL.md` as the supporting behavioral contract, then apply it directly.

- Stage: finalize
- Owner agents: publisher
- Required inputs: `WORK_SUMMARY`
- Output contract: `finalize-work-v2`
- Risk: none
- Recommended packs: release, docs

Preserve all safety, approval, output, failure, and validation requirements in the supporting contract. If a required input or safety boundary is missing, stop before side effects and report the blocker.

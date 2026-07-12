---
id: implement-plan
stage: implement
title: /nova-plugin:implement-plan
description: "Implement strictly from an approved plan; requires PLAN_INPUT_PATH and PLAN_APPROVED=true."
destructive-actions: medium
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:implement-plan

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-implement-plan` through the Skill tool.

Before answering, use Read to load both `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/implement-plan.json` as the machine-readable policy summary and `${CLAUDE_PLUGIN_ROOT}/skills/nova-implement-plan/SKILL.md` as the authoritative behavioral contract, then execute the workflow directly. If either contract cannot be loaded or they conflict, fail closed and report contract drift.

- Stage: implement
- Owner agents: builder
- Required inputs: `PLAN_INPUT_PATH`, `PLAN_APPROVED`
- Output contract: `implementation-plan-v2`
- Risk: medium
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in both contracts. If a required input or safety boundary is missing, stop before side effects and report the blocker.

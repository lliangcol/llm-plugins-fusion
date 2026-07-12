---
id: plan-lite
stage: plan
title: /nova-plugin:plan-lite
description: "Create a lightweight execution plan without writing code or formal artifacts."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:plan-lite

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-plan-lite` through the Skill tool.

Before answering, use Read to load both `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/plan-lite.json` as the machine-readable policy summary and `${CLAUDE_PLUGIN_ROOT}/skills/nova-plan-lite/SKILL.md` as the authoritative behavioral contract, then execute the workflow directly. If either contract cannot be loaded or they conflict, fail closed and report contract drift.

- Stage: plan
- Owner agents: architect
- Required inputs: `REQUEST`
- Output contract: `plan-lite-v2`
- Risk: none
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in both contracts. If a required input or safety boundary is missing, stop before side effects and report the blocker.

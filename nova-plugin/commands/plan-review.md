---
id: plan-review
stage: plan
title: /nova-plugin:plan-review
description: "Critically review an existing plan for decision clarity, assumptions, and execution risk."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:plan-review

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-plan-review` through the Skill tool.

Before answering, use Read to load both `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/plan-review.json` as the machine-readable policy summary and `${CLAUDE_PLUGIN_ROOT}/skills/nova-plan-review/SKILL.md` as the authoritative behavioral contract, then execute the workflow directly. If either contract cannot be loaded or they conflict, fail closed and report contract drift.

- Stage: review
- Owner agents: reviewer
- Required inputs: `PLAN_INPUT_PATH`
- Output contract: `plan-review-v2`
- Risk: none
- Recommended packs: docs, security

Preserve all safety, approval, output, failure, and validation requirements in both contracts. If a required input or safety boundary is missing, stop before side effects and report the blocker.

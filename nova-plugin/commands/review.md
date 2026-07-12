---
id: review
stage: review
title: /nova-plugin:review
description: "Unified review entry that routes by LEVEL for lite, standard, or strict review without fixes."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:review

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-review` through the Skill tool.

Before answering, use Read to load both `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/review.json` as the machine-readable policy summary and `${CLAUDE_PLUGIN_ROOT}/skills/nova-review/SKILL.md` as the authoritative behavioral contract, then execute the workflow directly. If either contract cannot be loaded or they conflict, fail closed and report contract drift.

- Stage: review
- Owner agents: reviewer
- Required inputs: `REVIEW_SCOPE`
- Output contract: `review-v2`
- Risk: none
- Recommended packs: security, dependency

Preserve all safety, approval, output, failure, and validation requirements in both contracts. If a required input or safety boundary is missing, stop before side effects and report the blocker.

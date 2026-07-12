---
id: explore
stage: explore
title: /nova-plugin:explore
description: "Unified exploration entry that routes observer or reviewer perspectives without modifying code."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:explore

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-explore` through the Skill tool.

Before answering, use Read to load both `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/explore.json` as the machine-readable policy summary and `${CLAUDE_PLUGIN_ROOT}/skills/nova-explore/SKILL.md` as the authoritative behavioral contract, then execute the workflow directly. If either contract cannot be loaded or they conflict, fail closed and report contract drift.

- Stage: explore
- Owner agents: orchestrator, reviewer
- Required inputs: `INPUT`
- Output contract: `exploration-v2`
- Risk: none
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in both contracts. If a required input or safety boundary is missing, stop before side effects and report the blocker.

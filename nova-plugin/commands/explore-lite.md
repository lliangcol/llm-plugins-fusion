---
id: explore-lite
stage: explore
title: /nova-plugin:explore-lite
description: "Quick observer-style exploration for fast understanding alignment without design or implementation."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:explore-lite

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-explore-lite` through the Skill tool.

Before answering, use Read to load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/explore-lite.json` as the compiled runtime contract, then apply it directly. The full compatibility skill is a maintainer reference and is not required for ordinary direct execution.

- Stage: explore
- Owner agents: orchestrator
- Required inputs: `INPUT`
- Output contract: `exploration-lite-v2`
- Risk: none
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in the compiled contract. If a required input or safety boundary is missing, stop before side effects and report the blocker.

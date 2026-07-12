---
id: senior-explore
stage: explore
title: /nova-plugin:senior-explore
description: "Run deep exploration for complex requirements or incidents, optionally writing an analysis artifact."
destructive-actions: low
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit Bash
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:senior-explore

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-senior-explore` through the Skill tool.

Before answering, use Read to load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/senior-explore.json` as the compiled runtime contract, then apply it directly. The full compatibility skill is a maintainer reference and is not required for ordinary direct execution.

- Stage: explore
- Owner agents: architect, reviewer
- Required inputs: `INTENT`, `CONTEXT`
- Output contract: `senior-exploration-v2`
- Risk: low
- Recommended packs: None

Preserve all safety, approval, output, failure, and validation requirements in the compiled contract. If a required input or safety boundary is missing, stop before side effects and report the blocker.

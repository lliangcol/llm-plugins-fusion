---
id: backend-plan
stage: plan
title: /nova-plugin:backend-plan
description: "Generate a Java/Spring backend design plan and write it to an explicit PLAN_OUTPUT_PATH."
destructive-actions: low
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit Bash
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:backend-plan

Execute this workflow directly from `$ARGUMENTS`. Do not invoke the compatibility skill `nova-backend-plan` through the Skill tool.

Before answering, use Read to load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/backend-plan.json` as the compiled runtime contract, then apply it directly. The full compatibility skill is a maintainer reference and is not required for ordinary direct execution.

- Stage: plan
- Owner agents: architect
- Required inputs: `REQUEST`, `PLAN_OUTPUT_PATH`
- Output contract: `backend-plan-v2`
- Risk: low
- Recommended packs: java, security, dependency

Preserve all safety, approval, output, failure, and validation requirements in the compiled contract. If a required input or safety boundary is missing, stop before side effects and report the blocker.

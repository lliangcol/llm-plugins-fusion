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

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/backend-plan.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-produce-plan/SKILL.md`, then execute canonical surface `nova-produce-plan` with variant preset `{"PLAN_PROFILE":"java-backend"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: plan
- Owner agents: architect
- Required inputs: `REQUEST`, `PLAN_OUTPUT_PATH`
- Output contract: `backend-plan-v2`
- Risk: low
- Recommended packs: java, security, dependency

If required input, approval, capability, or safety state is unresolved, stop before side effects.

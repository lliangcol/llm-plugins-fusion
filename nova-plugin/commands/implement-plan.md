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

Canonical command wrapper.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/implement-plan.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-implement-plan/SKILL.md`, then execute canonical surface `nova-implement-plan` with variant preset `{}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: implement
- Owner agents: builder
- Required inputs: `PLAN_INPUT_PATH`, `PLAN_APPROVED`
- Output contract: `implementation-plan-v2`
- Risk: medium
- Recommended packs: None

If required input, approval, capability, or safety state is unresolved, stop before side effects.

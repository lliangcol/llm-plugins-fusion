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

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/plan-lite.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-produce-plan/SKILL.md`, then execute canonical surface `nova-produce-plan` with variant preset `{"PLAN_PROFILE":"lite"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: plan
- Owner agents: architect
- Required inputs: `REQUEST`
- Output contract: `plan-lite-v2`
- Risk: none
- Recommended packs: None

If required input, approval, capability, or safety state is unresolved, stop before side effects.

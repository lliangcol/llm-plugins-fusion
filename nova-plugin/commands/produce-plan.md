---
id: produce-plan
stage: plan
title: /nova-plugin:produce-plan
description: "Write a formal review-ready plan document to an explicit PLAN_OUTPUT_PATH."
destructive-actions: low
allowed-tools: Read Glob Grep Write Edit
disallowed-tools: NotebookEdit Bash
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:produce-plan

Canonical command wrapper.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/produce-plan.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-produce-plan/SKILL.md`, then execute canonical surface `nova-produce-plan` with variant preset `{}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: plan
- Owner agents: architect
- Required inputs: `REQUEST`, `PLAN_OUTPUT_PATH`
- Output contract: `produce-plan-v2`
- Risk: low
- Recommended packs: docs

If required input, approval, capability, or safety state is unresolved, stop before side effects.

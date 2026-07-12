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

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/plan-review.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-review/SKILL.md`, then execute canonical surface `nova-review` with variant preset `{"REVIEW_PROFILE":"plan"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: review
- Owner agents: reviewer
- Required inputs: `PLAN_INPUT_PATH`
- Output contract: `plan-review-v2`
- Risk: none
- Recommended packs: docs, security

If required input, approval, capability, or safety state is unresolved, stop before side effects.

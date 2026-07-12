---
id: review
stage: review
title: /nova-plugin:review
description: "Unified review entry that routes by LEVEL for lite, standard, or strict review without fixes."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:review

Canonical command wrapper.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/review.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-review/SKILL.md`, then execute canonical surface `nova-review` with variant preset `{}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: review
- Owner agents: reviewer
- Required inputs: `REVIEW_SCOPE`
- Output contract: `review-v2`
- Risk: none
- Recommended packs: security, dependency

If required input, approval, capability, or safety state is unresolved, stop before side effects.

---
id: review-only
stage: review
title: /nova-plugin:review-only
description: "Run a standard-depth review for correctness, failure modes, tests, and maintainability without fixes."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:review-only

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/review-only.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-review/SKILL.md`, then execute canonical surface `nova-review` with variant preset `{"LEVEL":"standard"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: review
- Owner agents: reviewer
- Required inputs: `REVIEW_SCOPE`
- Output contract: `review-only-v2`
- Risk: none
- Recommended packs: security, dependency

If required input, approval, capability, or safety state is unresolved, stop before side effects.

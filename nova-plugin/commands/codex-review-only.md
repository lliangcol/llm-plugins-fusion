---
id: codex-review-only
stage: review
title: /nova-plugin:codex-review-only
description: "Run Codex review only and write a structured review artifact without modifying code."
destructive-actions: low
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:codex-review-only

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/codex-review-only.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-review/SKILL.md`, then execute canonical surface `nova-review` with variant preset `{"REVIEW_PROFILE":"codex-review-only"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: review
- Owner agents: reviewer
- Required inputs: `REVIEW_SCOPE`
- Output contract: `codex-review-only-v2`
- Risk: low
- Recommended packs: None

If required input, approval, capability, or safety state is unresolved, stop before side effects.

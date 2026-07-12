---
id: explore-review
stage: explore
title: /nova-plugin:explore-review
description: "Review-oriented exploration that surfaces questions and risks without proposing fixes."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit Bash
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:explore-review

**Deprecated compatibility alias:** this wrapper remains for the 4.x migration window.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/explore-review.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-explore/SKILL.md`, then execute canonical surface `nova-explore` with variant preset `{"PERSPECTIVE":"reviewer"}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: explore
- Owner agents: reviewer
- Required inputs: `INPUT`
- Output contract: `exploration-review-v2`
- Risk: none
- Recommended packs: security, dependency

If required input, approval, capability, or safety state is unresolved, stop before side effects.

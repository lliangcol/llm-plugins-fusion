---
id: finalize-work
stage: finalize
title: /nova-plugin:finalize-work
description: "Finalize completed work with handoff, validation, and commit or PR-ready summary text."
destructive-actions: none
allowed-tools: Read Glob Grep
disallowed-tools: Write Edit NotebookEdit
user-invocable: true
disable-model-invocation: false
---

# /nova-plugin:finalize-work

Canonical command wrapper.

Load `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/finalize-work.json` and canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-finalize-work/SKILL.md`, then execute canonical surface `nova-finalize-work` with variant preset `{}` merged beneath explicit non-conflicting `$ARGUMENTS`. Never copy or override behavior in this wrapper; the runtime contract and canonical skill are authoritative. If they differ, fail closed.

- Stage: finalize
- Owner agents: publisher
- Required inputs: `WORK_SUMMARY`
- Output contract: `finalize-work-v2`
- Risk: none
- Recommended packs: release, docs

If required input, approval, capability, or safety state is unresolved, stop before side effects.

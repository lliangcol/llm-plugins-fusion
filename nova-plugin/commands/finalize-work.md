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

Start from declared wrapper contract `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/finalize-work.json` and merge variant preset `{}` beneath explicit non-conflicting `$ARGUMENTS`. From the merged inputs, extract only the selector keys declared for `finalize-work` in `${CLAUDE_PLUGIN_ROOT}/runtime/resolved-variant-contracts.json`; ordinary inputs such as requests, approvals, and paths must never enter the resolution key. Validate selector values and apply declared defaults before matching. Use an exact normalized override when present. A non-exact combination that triggers any alias specialization is conflicting and must stop; only a valid combination that triggers no alias specialization may use the canonical fallback. Load the resolved runtime contract and compare its `id` to the invoked command id `finalize-work`. Claude native frontmatter is static: if the resolved id differs, STOP before tools or side effects and invoke the exact direct command `/nova-plugin:<resolved commandEntrypoint.directCommandId>`; do not execute another workflow's contract under this wrapper. Continue only when the ids match, then load the canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-finalize-work/SKILL.md`. The complete resolved runtime contract is authoritative, including allowedTools, disallowedTools, modelInvocable, subagentSafe, destructiveActions, and commandEntrypoint; no field falls back to canonical Skill prose. Generic and Codex adapters may instead execute the resolved contract directly under their adapter enforcement. If a selector is undeclared, unsupported, conflicting, or resolution is ambiguous, fail closed.

- Stage: finalize
- Owner agents: publisher
- Required inputs: `WORK_SUMMARY`
- Output contract: `finalize-work-v2`
- Risk: none
- Recommended packs: release, docs

If required input, approval, capability, or safety state is unresolved, stop before side effects.

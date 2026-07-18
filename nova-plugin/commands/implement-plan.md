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

Start from declared wrapper contract `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/implement-plan.json` and merge variant preset `{}` beneath explicit non-conflicting `$ARGUMENTS`. From the merged inputs, extract only the selector keys declared for `implement-plan` in `${CLAUDE_PLUGIN_ROOT}/runtime/resolved-variant-contracts.json`; ordinary inputs such as requests, approvals, and paths must never enter the resolution key. Validate selector values and apply declared defaults before matching. Use an exact normalized override when present. A non-exact combination that triggers any alias specialization is conflicting and must stop; only a valid combination that triggers no alias specialization may use the canonical fallback. Load the resolved runtime contract and compare its `id` to the invoked command id `implement-plan`. Claude native frontmatter is static: if the resolved id differs, STOP before tools or side effects and invoke the exact direct command `/nova-plugin:<resolved commandEntrypoint.directCommandId>`; do not execute another workflow's contract under this wrapper. Continue only when the ids match, then load the canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-implement-plan/SKILL.md`. The complete resolved runtime contract is authoritative, including allowedTools, disallowedTools, modelInvocable, subagentSafe, destructiveActions, and commandEntrypoint; no field falls back to canonical Skill prose. Generic and Codex adapters may instead execute the resolved contract directly under their adapter enforcement. If a selector is undeclared, unsupported, conflicting, or resolution is ambiguous, fail closed.

- Stage: implement
- Owner agents: builder
- Required inputs: `PLAN_INPUT_PATH`, `PLAN_APPROVED`
- Output contract: `implementation-plan-v2`
- Risk: medium
- Recommended packs: None

If required input, approval, capability, or safety state is unresolved, stop before side effects.

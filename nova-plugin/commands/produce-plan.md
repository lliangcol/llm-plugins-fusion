---
id: produce-plan
stage: plan
title: /nova-plugin:produce-plan
description: "Write a review-ready plan artifact from explicit intent and constraints without implementing code."
destructive-actions: low
allowed-tools: Read Glob Grep
disallowed-tools: NotebookEdit Bash
user-invocable: true
disable-model-invocation: true
---

# /nova-plugin:produce-plan

Canonical command wrapper.

Start from declared wrapper contract `${CLAUDE_PLUGIN_ROOT}/runtime/contracts/produce-plan.json` and merge variant preset `{}` beneath explicit non-conflicting `$ARGUMENTS`. From the merged inputs, extract only the selector keys declared for `produce-plan` in `${CLAUDE_PLUGIN_ROOT}/runtime/resolved-variant-contracts.json`; ordinary inputs such as requests, approvals, and paths must never enter the resolution key. Validate selector values and apply declared defaults before matching. Use an exact normalized override when present. A non-exact combination that triggers any alias specialization is conflicting and must stop; only a valid combination that triggers no alias specialization may use the canonical fallback. Load the resolved runtime contract and compare its `id` to the invoked command id `produce-plan`. Claude native frontmatter is static: if the resolved id differs, STOP before tools or side effects and invoke the exact direct command `/nova-plugin:<resolved commandEntrypoint.directCommandId>`; do not execute another workflow's contract under this wrapper. Continue only when the ids match, then load the canonical skill `${CLAUDE_PLUGIN_ROOT}/skills/nova-produce-plan/SKILL.md`. The complete resolved runtime contract is authoritative, including allowedTools, disallowedTools, modelInvocable, subagentSafe, destructiveActions, and commandEntrypoint; no field falls back to canonical Skill prose. Generic and Codex adapters may instead execute the resolved contract directly under their adapter enforcement. If a selector is undeclared, unsupported, conflicting, or resolution is ambiguous, fail closed.

- Stage: plan
- Owner agents: architect
- Required inputs: `REQUEST`, `PLAN_OUTPUT_PATH`
- Output contract: `produce-plan-v2`
- Risk: low
- Recommended packs: docs

If required input, approval, capability, or safety state is unresolved, stop before side effects.

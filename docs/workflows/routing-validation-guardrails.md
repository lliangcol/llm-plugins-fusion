# Routing and Validation Guardrails

Status: active
Date: 2026-05-12

This document explains the guardrails that keep `nova-plugin` routing,
checkpointing, and validation evidence reliable without expanding the public
command surface. It is a maintenance guide for the changes that harden
`/route`, checkpoint artifacts, validation claims, prompt-surface budgets, and
distribution-risk scanning.

## Why This Exists

Agent workflows become unreliable when three things drift:

- routing chooses a broad workflow instead of the smallest safe next command;
- checkpoints and verification summaries say checks passed without naming the
  behavior or repository fact those checks prove;
- prompts, skills, and packs grow until their useful operating contract is hard
  to inspect.

These guardrails keep those risks visible. They are not a new workflow stage
and they do not replace review, planning, implementation, or release evidence.

## Guardrail Map

| Guardrail | Primary surface | Purpose | Validation |
| --- | --- | --- | --- |
| First-stage routing | `/route`, `nova-route`, command docs, routing docs | Classify intent before recommending the next command, skill, core agent, packs, required inputs, validation expectations, and fallback path. | `node scripts/lint-frontmatter.mjs`, `node scripts/validate-docs.mjs` |
| Checkpoint artifacts | `docs/prompts/common/checkpoint-artifact.md`, workbench template, artifact policy | Preserve resumable state for long-running private work without relying on chat history. | `node scripts/validate-docs.mjs` |
| Verification evidence mapping | shared output contracts, Codex verification prompt, context-safe workflow docs | Prevent "tests passed" from standing in for behavior, repository fact, review finding, or change-goal evidence. | Review artifact inspection plus focused checks named by the workflow |
| Prompt-surface budget | `scripts/validate-surface-budget.mjs`, CI, npm shortcut, allowlist | Keep public command, skill, agent, and pack surfaces small enough to audit. | `node scripts/validate-surface-budget.mjs` |
| Distribution-risk scanning | `scripts/scan-distribution-risk.mjs`, regression tests, trust/security docs | Block private data signals, broad permission-bypass advice, and tracked `.codex/` runtime artifacts from public distribution. | `node scripts/scan-distribution-risk.mjs`, `node scripts/validate-regression.mjs` |

## Routing Rules

`/route` is a read-only first-stage router. It should:

1. classify the request as Explore, Plan, Review, Implement, Finalize, or Codex
   loop;
2. recommend one next command when possible;
3. return a short sequence only when the request genuinely spans multiple
   workflow stages;
4. name the one-to-one skill, core agent, capability packs, required inputs,
   validation expectations, and fallback path;
5. avoid implementation details, plan content, test execution, Git operations,
   and artifact writes.

The route output is a recommendation, not evidence that validation has passed.

## Evidence Rules

Verification summaries and checkpoints should separate checks from behavior:

- `Validation` records commands or checks actually run and observed results.
- `Behavior Verified` records the acceptance behavior, repository fact, review
  finding, or change goal supported by the evidence.
- `Skipped or Unverified` records skipped checks, unverified behavior or facts,
  reasons, and residual risk.

Do not mark a review finding as resolved unless code evidence and validation
evidence both map back to the original expected behavior.

## Surface Budget Rules

Surface budgets are a prompt bloat guard, not a quality score.

Default budgets:

| Surface | Default line budget |
| --- | ---: |
| Command Markdown | 120 |
| `nova-*` skill `SKILL.md` | 300 |
| Core agent Markdown | 250 |
| Pack README | 220 |

When a surface exceeds its default budget, prefer splitting reusable procedure
into shared policy, command docs, prompt templates, or deterministic scripts.
Use `scripts/surface-budget.allowlist.json` only when the exception is
intentional, temporary, and includes a split plan.

## Permission Posture

Public `nova-plugin` guidance should not recommend blanket permission bypasses
as the default path. Write-capable commands, Bash scripts, Codex loops, and
external tools should keep scope explicit through parameters, safety preflight,
artifact boundaries, and validation evidence.

Negative guidance that warns against broad permission bypasses is acceptable.
Affirmative guidance that recommends broad bypasses should trigger security
review and distribution-risk scanning.

## Maintenance Checklist

Use this checklist when changing routing, checkpoint, validation, prompt,
security, or CI guardrails:

- Update the command, skill, docs, and user-facing guide that own the behavior.
- Keep `/route` read-only and first-stage.
- Ensure checkpoints map evidence to behavior or repository facts.
- Add or update `CHANGELOG.md` for user-visible workflow or validation changes.
- Run `node scripts/validate-surface-budget.mjs` when command, skill, agent, or
  pack surfaces change.
- Run `node scripts/scan-distribution-risk.mjs` when public docs, prompts,
  scripts, or release artifacts change.
- Run `node scripts/validate-all.mjs` for broad workflow or guardrail changes.

## Related Documents

- [Context-Safe Agent Workflows](context-safe-agent-workflows.md)
- [GSD-Informed Reliability Hardening](gsd-informed-hardening.md)
- [Verification Evidence Contract](verification-evidence-contract.md)
- [Thin Harness, Fat Skills Workflow Doctrine](thin-harness-fat-skills.md)
- [Checkpoint Artifact Prompt](../prompts/common/checkpoint-artifact.md)
- [Workbench Consumer Template](../consumers/workbench-template.md)
- [Security Review Route](../marketplace/security-review-route.md)
- [Trust Policy](../marketplace/trust-policy.md)

## Validation

For documentation-only changes to this guide:

```bash
node scripts/validate-docs.mjs
git diff --check
```

For changes that alter scripts, CI, command behavior, skills, or release
guardrails, run `node scripts/validate-all.mjs`.

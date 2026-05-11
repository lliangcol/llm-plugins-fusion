# Verification Evidence Contract

Status: active
Date: 2026-05-12

This document explains the repository-wide contract for claiming that work is
verified. It is public-safe workflow guidance for `nova-plugin` maintainers and
consumer-profile authors. It must not include private consumer names, local
machine paths, endpoints, credentials, repository addresses, runtime flags,
business rules, or private knowledge-base content.

## Why This Exists

AI-agent workflows often fail after a command reports success but before the
intended behavior is proven. A test command can pass while testing the wrong
thing, a review finding can be marked resolved without checking the original
failure mode, or a long task can continue after losing track of what was
actually verified.

The stable rule is:

```text
Do not claim completion from tool success alone. Map evidence back to the
behavior, repository fact, review finding, or change goal being verified.
```

This contract turns that rule into an output standard for checkpoints,
verification summaries, review/fix loops, and final handoffs.

## Contract Summary

Every verification claim should answer four questions:

| Question | Required answer |
| --- | --- |
| What was checked? | Command, artifact, code path, diff, document, or manual inspection target. |
| What did it prove? | Acceptance behavior, repository fact, review finding, or change goal. |
| What is still unverified? | Skipped checks, unavailable tools, edge cases, or residual risk. |
| What evidence supports the claim? | Observed command output, artifact path, cited source file, review artifact, or checkpoint. |

Passing checks are useful evidence, but they are not sufficient by themselves.
The handoff must say what behavior or fact the checks cover.

## Evidence Types

Use the narrowest evidence that proves the claim.

| Claim type | Good evidence | Weak evidence |
| --- | --- | --- |
| Behavior works | Focused test, acceptance check, screenshot, or manual reproduction tied to the expected behavior. | A broad test suite passed without naming what behavior it covers. |
| Review finding resolved | Code evidence plus validation mapped to the original finding and expected behavior. | "Fixed" or "tests pass" without referencing the finding. |
| Repository fact is true | Source-of-truth file, generated output, schema, validator, or command output. | Memory, assumption, or a stale summary. |
| Change goal completed | Diff summary tied to plan step, requirement, or acceptance point. | List of files changed without outcome mapping. |
| Check skipped | Environment or tool reason plus residual risk and fallback evidence if available. | Silent omission or reporting the check as passed. |

## Checkpoint Evidence Fields

Long-running work should leave review-unit or acceptance-unit checkpoints. A
checkpoint is useful when another agent can resume from it without reading the
full chat history.

At minimum, checkpoints should capture these evidence fields. Prompt templates
may use equivalent section names when the meaning is the same.

```markdown
# Checkpoint: <task or unit>

## Scope

## Inputs Read

## Work Completed

## Decisions

## Evidence

## Behavior or Facts Verified

## Validation

## Skipped or Unverified

## Open Items or Residual Risk

## Next Unit
```

For private consumer work, use the reusable prompt in
[Checkpoint Artifact Prompt](../prompts/common/checkpoint-artifact.md) and
store the artifact in the consumer workbench, not this public repository.

## Verification Summary Minimum

A verification summary should include:

- checks run and observed result;
- artifact or command evidence;
- behavior, repository fact, review finding, or change goal covered by each
  check;
- skipped or unavailable checks with reasons;
- known unverified behavior, repository facts, edge cases, or residual risk;
- final gate: deliverable yes, no, or conditional, with blockers when present.

For Codex verification after fixes, use
[Codex Final Verification Prompt](../prompts/codex/final-verification.md). A
finding should be `resolved` only when code evidence and validation evidence
both map back to the finding's expected behavior.

## Failure Signals

Stop and tighten the checkpoint or verification output when any of these
appear:

- "tests pass" is the only completion evidence;
- a review finding is marked resolved without citing its original expected
  behavior;
- skipped checks are absent from the final handoff;
- a long task continues without a checkpoint that names verified facts and
  open risk;
- conflicting repository guidance is blended instead of resolved through
  [CLAUDE.md](../../CLAUDE.md) and the source-of-truth table;
- private consumer facts are copied into public workflow docs.

## Where The Contract Applies

| Surface | Contract application |
| --- | --- |
| [CLAUDE.md](../../CLAUDE.md) | Canonical repository guidance for evidence, checkpoints, and instruction conflicts. |
| [AGENTS.md](../../AGENTS.md) | Codex and generic-agent adapter that points to the same evidence expectations. |
| [Shared Output Contracts](../../nova-plugin/skills/_shared/output-contracts.md) | Skill-level verification output requirements. |
| [Context-Safe Agent Workflows](context-safe-agent-workflows.md) | Review unit, fix loop, and checkpoint method. |
| [Routing and Validation Guardrails](routing-validation-guardrails.md) | Maintenance guardrails for routing, checkpoint evidence, prompt budgets, and distribution-risk scanning. |
| [Serial Checkpoint Prompt](../prompts/claude-code/serial-checkpoint.md) | Claude Code prompt for one-unit-at-a-time work. |
| [Codex Final Verification Prompt](../prompts/codex/final-verification.md) | Codex prompt for verifying fixes against an existing review artifact. |

## Maintenance Rules

- Keep this document focused on verification evidence, not broad agent
  behavior.
- Update this document when checkpoint fields, shared output contracts, or
  final verification prompts change.
- Do not duplicate full prompt bodies here; link to prompt templates instead.
- For documentation-only edits, run:

```bash
node scripts/validate-docs.mjs
git diff --check
```

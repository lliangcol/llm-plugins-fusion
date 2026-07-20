<!-- migrated-from: docs/examples/primary-workflow-transcript.md -->
# Primary Workflow Transcript

Status: executable documentation fixture, not live-assistant evidence

This public-safe transcript shows the six recommended entry points with exact
canonical inputs. It is an operator guide: outputs are abbreviated shapes, not
claims that a model run occurred. Use `evals/live/` for measured evidence.

## Before

```text
invoice-sync/
|-- request.md
|-- src/invoice-sync.mjs
`-- test/invoice-sync.test.mjs
```

The fictional defect marks an invoice synchronized before the external send
succeeds. No plan artifact or approval exists yet.

## 1. Route

```text
/nova-plugin:route REQUEST="Investigate the invoice ordering defect and prepare a safe fix." DEPTH=brief
```

Expected shape: `## Recommended Route` plus the eight fixed fields, beginning
with `Canonical skill`, `Command entrypoint`, and `Variant parameters`. `Required
inputs` must use downstream canonical names such as `INPUT`, never prose or an
alias.

## 2. Explore

```text
/nova-plugin:explore INPUT="request.md and current invoice-sync behavior" PERSPECTIVE=reviewer
```

Expected shape: `What is clear`, `Review questions`, `Risk signals`; no design
or code edits.

## 3. Produce Plan

```text
/nova-plugin:produce-plan REQUEST="Move the synced marker after successful send; preserve public API and avoid schema changes." PLAN_OUTPUT_PATH="docs/plans/invoice-sync.md" PLAN_PROFILE=general
```

Expected mutation: only the explicit plan artifact is created. Chat contains
the path and executive summary, not the full plan.

## 4. Review

```text
/nova-plugin:review REVIEW_SCOPE="docs/plans/invoice-sync.md" LEVEL=standard
```

Expected shape: `Critical`, `Major`, `Minor` findings with evidence and
directional guidance; no implementation patch.

## 5. Implement Approved Plan

```text
/nova-plugin:implement-plan PLAN_INPUT_PATH="docs/plans/invoice-sync.md" PLAN_APPROVED=true
```

Expected mutation: the plan-scoped source/test changes only. A missing or
non-exact `PLAN_APPROVED` value stops before writes. Project test commands must
also be present as exact argv in `.nova/shell-policy.json` before the Bash
broker permits them.

## 6. Finalize

```text
/nova-plugin:finalize-work WORK_SUMMARY="Invoice ordering fix, focused regression test, and actual validation outcomes."
```

Expected shape: commit/PR-ready handoff text, actual passed/failed/skipped
validation, residual risk, and out-of-scope follow-up. It performs no commit,
push, release, or new edit.

## After

```text
invoice-sync/
|-- .nova/shell-policy.json
|-- docs/plans/invoice-sync.md
|-- request.md
|-- src/invoice-sync.mjs
`-- test/invoice-sync.test.mjs
```

Behavioral delta:

- `markSynced` occurs only after the external send succeeds.
- A focused failure-path regression test exists.
- Validation evidence reports what actually ran.
- No schema, unrelated module, user-scope state, Git history, or release state
  changed.

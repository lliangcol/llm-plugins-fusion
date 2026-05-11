# Invoice Sync Workflow Fixture

Status: public-safe disposable fixture
Purpose: manual evaluation of the five primary `nova-plugin` workflow commands

This fixture is fictional. It exists so maintainers can run the primary workflow
without copying private project names, paths, endpoints, credentials, runtime
flags, repository addresses, or real business rules into release evidence.

## Scenario

A product note says invoices should sync every night. The note does not define
retry behavior, ownership, data freshness, or exactly when an invoice can be
marked as synced.

Use this fixture to evaluate:

```text
/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
```

## Files

| File | Use |
| --- | --- |
| [inputs/product-note.md](inputs/product-note.md) | Ambiguous request for `/explore`. |
| [inputs/planning-brief.md](inputs/planning-brief.md) | Planning scenario for `/produce-plan`. |
| [inputs/review-diff.patch](inputs/review-diff.patch) | Fictional buggy diff for `/review`. |
| [plans/approved-implementation-plan.md](plans/approved-implementation-plan.md) | Approved plan input for `/implement-plan`. |

## Suggested Manual Commands

Run these only in a disposable copy or throwaway branch:

```text
/explore INPUT=fixtures/workflow/invoice-sync/inputs/product-note.md
/produce-plan PLAN_OUTPUT_PATH=fixtures/workflow/invoice-sync/out/plan.md PLAN_INTENT="Plan idempotent invoice sync with no schema migration" ANALYSIS_INPUTS=fixtures/workflow/invoice-sync/inputs/planning-brief.md
/review LEVEL=standard INPUT=fixtures/workflow/invoice-sync/inputs/review-diff.patch
/implement-plan PLAN_INPUT_PATH=fixtures/workflow/invoice-sync/plans/approved-implementation-plan.md PLAN_APPROVED=true
/finalize-work Summarize the completed fixture run, validation, skipped checks, risks, and follow-ups.
```

## Pass Signals

- Read-only commands do not edit project code.
- Facts, assumptions, unknowns, and validation status are distinguishable.
- The plan preserves the no-schema-change constraint.
- Review catches the status-update-before-success bug and missing retry tests.
- Implementation stays scoped to the approved plan.
- Finalization does not claim tests passed unless they actually ran.

## Safety

- Keep generated outputs under `fixtures/workflow/invoice-sync/out/` or a
  disposable branch.
- Do not copy private consumer facts into this fixture.
- Do not use this fixture as product or legal requirements; it is only a
  release-evidence evaluation harness.

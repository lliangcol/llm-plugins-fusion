# Approved Implementation Plan

Status: approved fixture plan
Approval flag for evaluation: `PLAN_APPROVED=true`

## Goal

Move the local synced status update so an invoice is marked as synced only after
the external accounting send succeeds.

## Non-Goals

- No schema migration.
- No new dependency.
- No scheduler rewrite.
- No real external endpoint or private configuration.

## Steps

1. Inspect the existing invoice sync function and tests in the disposable
   fixture or throwaway consumer branch.
2. Ensure the external send happens before `markSynced`.
3. Preserve logging for both success and failure.
4. Add focused tests for:
   - successful send marks synced;
   - external failure does not mark synced;
   - duplicate nightly run does not create duplicate send effects when local
     state already indicates synced;
   - skipped validation is reported if the disposable fixture has no test
     runner.

## Validation

Use the disposable fixture's available test command. If no runnable command is
present, record validation as skipped with the exact reason.

## Rollback

Revert the scoped sync function and test changes in the disposable branch.

## Assumptions

- Existing status values are sufficient.
- Idempotency can be preserved without a schema change.
- External send success is the only condition that permits `markSynced`.

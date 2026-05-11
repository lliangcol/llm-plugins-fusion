# Planning Brief

Plan a small, idempotent nightly invoice sync change.

Constraints:

- No schema migration.
- No new runtime dependency.
- Keep behavior compatible with the existing pending/synced status model.
- Preserve the existing scheduler entry point.
- Mark an invoice as synced only after the external send succeeds.
- Add focused tests for success, external failure, retry safety, and duplicate
  run behavior.

Expected plan sections:

- Goals and non-goals.
- Existing behavior to inspect.
- Proposed implementation steps.
- Failure modes.
- Validation commands.
- Rollback or disablement path.
- Assumptions and owner questions.

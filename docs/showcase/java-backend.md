# Java Backend Showcase

Status: active
Date: 2026-06-02

## Problem

A backend task often starts as an imprecise request: add a behavior, preserve an
existing API contract, avoid duplicate side effects, and prove the fix with the
right module-level checks. Jumping straight to edits can miss transaction,
idempotency, DTO, schema, cache, queue, or rollback boundaries.

## Recommended nova workflow

```text
/nova-plugin:route -> /nova-plugin:explore -> /nova-plugin:produce-plan -> /nova-plugin:review -> /nova-plugin:implement-plan -> /nova-plugin:finalize-work
```

- Use `/nova-plugin:route` to pick the smallest safe next command and required validation.
- Use `/nova-plugin:explore` to gather current controller, service, repository, schema, and
  test facts without proposing a fix too early.
- Use `/nova-plugin:produce-plan` to define a scoped implementation and verification path.
- Use `/nova-plugin:review` before edits when the plan touches persistence, async work,
  authorization, payment, or public API behavior.
- Use `/nova-plugin:implement-plan` only after the plan is approved.
- Use `/nova-plugin:finalize-work` to summarize changed files, validation, skipped checks,
  and residual risk.

## Example command

```text
/nova-plugin:route A Java backend change needs to preserve an existing API contract, update service behavior, and prove the result with targeted tests. Recommend the next nova workflow step and validation.
```

If `/nova-plugin:route` recommends exploration, continue with:

```text
/nova-plugin:explore Map the current backend flow for this redacted requirement. Collect controller, service, repository, validation, and test facts only; do not propose a solution yet.
```

## Expected output evidence

- Current behavior facts with file references or command output.
- Identified invariants such as authorization, idempotency, transaction
  boundary, DTO shape, schema/index expectations, and rollback path.
- A plan that separates implementation steps from validation steps.
- Review findings prioritized by severity before write-capable work begins.
- Final handoff listing changed files, tests/checks run, skipped checks, and
  residual risk.

## Validation

Use the consumer project's real build and test commands. For public examples in
this repository, keep validation generic and state unavailable checks honestly.

Typical private-project evidence may include targeted Maven/Gradle tests, API
contract checks, migration dry-runs, queue or scheduler smoke checks, and logs
that prove the changed behavior. Do not copy private command flags, endpoints,
tokens, tenant names, or internal service names into public docs.

## Private context boundary

Keep real service names, endpoints, schema names, credentials, private
repository addresses, feature flags, tenant rules, and business logic in the
consumer repository. Public showcase content should use redacted names and
describe only transferable workflow shape.

<!-- migrated-from: docs/examples/java-backend/redacted-feature.md -->
# Redacted Java Backend Feature Example

This example uses a fictional backend feature. It is safe for the public
repository and does not describe a real consumer, private component, real path,
configuration values, or private project process.

## User Request

Add a new endpoint to update a generic resource preference in a private
Java/Spring backend consumer. The implementation should validate input, persist
the preference, and return a redacted response shape.

## Recommended Nova Workflow

```text
/nova-plugin:explore -> /nova-plugin:produce-plan -> /nova-plugin:review -> /nova-plugin:implement-plan -> /nova-plugin:finalize-work
```

Use `/nova-plugin:review LEVEL=strict` or a project-approved verification path if the
private project rules classify the change as high risk.

## Project Rules to Read

- Project-local `AGENTS.md` / `CLAUDE.md`.
- Private API conventions and error model docs, if present in the workspace.
- Existing controller, service, repository, DTO, and test patterns in the
  affected area.
- Local validation commands from the consumer profile.

## Expected Artifacts

- Exploration notes identifying the affected package area and uncertainty.
- Implementation plan with API shape, validation behavior, persistence boundary,
  tests, and rollback considerations.
- Code changes in the private consumer repository only.
- Test or validation output summary.
- Final handoff with skipped checks and residual risks.

## Suggested Validation Commands

Use the private consumer profile first. Generic examples:

```bash
mvn -pl <affected-module> test
mvn -pl <affected-module> -am verify
mvn test
```

For Gradle consumers, use the project's checked-in wrapper and replace the
generic module and task placeholders with the real project-approved values:

```bash
./gradlew :<affected-module>:test --tests '<focused-test-pattern>'
./gradlew :<affected-module>:check
./gradlew check
```

Record each command as `passed`, `skipped`, or `not run` based on actual
evidence. A missing wrapper, unavailable task, or intentionally deferred broad
check is not a pass; report the reason and any residual risk explicitly.

Do not publish private Maven profiles, repository addresses, network endpoints,
runtime flags, or environment-specific invocations in public docs.

## High-Risk Checks

- Transaction boundary: confirm writes occur in the intended service boundary.
- Idempotency: confirm repeated requests do not create duplicate effects.
- Concurrency: confirm simultaneous updates have the intended last-write or
  conflict behavior.
- DTO / Entity boundary: keep persistence objects out of public responses.
- Exception model: return errors through the project's standard model.
- Data source declaration: do not change persistence routing without explicit
  project-local approval.
- MQ / scheduled jobs: confirm no asynchronous side effects are introduced
  accidentally.
- Maven module validation: run affected module checks and broader checks when
  cross-module contracts change.
- Gradle module validation: use the consumer project's real wrapper and tasks;
  run a focused test plus broader module or repository checks when required.
- Observability: preserve or add generic logs, metrics, or audit points when
  required by private rules.
- Rollback plan: identify how the change can be reverted or disabled.

## Handoff Format

```markdown
Status:
Summary:
Files:
Validation:
Skipped:
High-risk checks:
Risks:
Next steps:
```

<!-- merged-from: docs/showcase/java-backend.md -->
<details>
<summary>Migrated source: docs/showcase/java-backend.md</summary>

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

</details>

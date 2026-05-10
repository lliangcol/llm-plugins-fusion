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
/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
```

Use `/review LEVEL=strict` or a project-approved verification path if the
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

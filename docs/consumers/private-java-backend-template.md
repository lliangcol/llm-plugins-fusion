# Private Java Backend Consumer Template

This is a redacted template for a private Java/Spring backend consumer, such as
a closed-source Maven multi-module backend. Copy the shape into the consumer's
private `AGENTS.md`, `CLAUDE.md`, `.claude/`, or private documentation, then
fill in local details there.

Do not replace placeholders with real private values in this public repository.

## Project Type

- Private Java/Spring backend consumer.
- Closed-source Maven multi-module backend.
- Uses `nova-plugin` as a workflow framework, not as a source of project-specific
  backend rules.

## Rules Source

- Treat project-local `AGENTS.md` / `CLAUDE.md` as the source of truth.
- Treat private architecture notes, API contracts, and runbooks as authoritative
  only when they are present in the consumer workspace.
- Public `nova-plugin` docs provide generic workflow and pack guidance only.

## Tech Stack

Fill this in privately:

- Java version:
- Spring framework family:
- Build tool: Maven
- Test framework:
- Persistence and data access patterns:
- Messaging or scheduled job patterns:
- Observability and logging conventions:

Keep public examples at the family level. Do not publish private component
identifiers, repository addresses, environment names, network endpoints, runtime
flags, credentials, or configuration values.

## Default Workflow

Routine backend changes should prefer:

```text
/explore -> /produce-plan -> /review -> /implement-plan -> /finalize-work
```

Use stricter review or verification when a change touches data integrity,
security, concurrency, integration contracts, or release-sensitive behavior.

## Default Validation Commands

Define concrete commands in the private consumer profile. Generic examples:

```bash
mvn test
mvn -pl <affected-module> test
mvn -pl <affected-module> -am verify
```

If a project uses wrappers, profiles, containers, or private services, document
those privately and do not publish the concrete invocation here.

## High-Risk Change Categories

- Transaction boundary changes.
- Idempotency, retry, or duplicate request behavior.
- Concurrency, locking, or async processing.
- DTO / Entity boundary changes.
- Exception model or error response changes.
- Data source declaration or persistence configuration changes.
- MQ consumer/producer or scheduled job behavior.
- Maven module dependency graph or parent configuration changes.
- Authentication, authorization, or sensitive data handling.
- Observability, alerting, audit logging, or rollback behavior.

## Capability Packs

Recommended packs:

- `java`
- `security`
- `dependency`
- `docs`
- `release`

Use project-local rules to decide whether frontend, marketplace, or MCP packs
also apply.

## Out-of-Scope Boundaries

- Do not infer private project workflows from public examples.
- Do not copy private component identifiers, package names, local paths,
  repository addresses, network endpoints, runtime flags, configuration values,
  credentials, or private docs into public artifacts.
- Do not run destructive data, migration, or deployment commands unless the
  private project source of truth explicitly authorizes them.
- Do not change command or skill behavior from this template; it only guides
  project-local profile authoring.

## Handoff Expectations

Backend handoff should include:

- Files changed and why.
- Validation commands run and exact skipped reasons.
- Transaction, idempotency, concurrency, DTO / Entity, exception, data source,
  MQ / scheduled job, Maven module, observability, and rollback checks that
  apply.
- Remaining risks and owner decisions needed before merge.

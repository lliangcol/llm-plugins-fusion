# Java Capability Pack

## Purpose

Support Java, Spring, Maven, and Gradle tasks across design, implementation, review, and verification.

## When to Use

Use this pack for Java source changes, Spring Boot configuration, controller/service/repository work, JVM build files, Maven or Gradle dependency changes, and Java test failures.

## Related Plugins

Optional enhancement: `jdtls-lsp`. It is not a hard dependency of `nova-plugin`.

## Inputs

- Java version, framework version, and build tool.
- Relevant modules, packages, controllers, services, repositories, and tests.
- Expected API or behavior changes.
- Build and test commands.

## Agent Routing

- `architect`: Java architecture, module boundaries, API shape, migration plans.
- `builder`: Java/Spring implementation and refactoring.
- `reviewer`: correctness, transaction, concurrency, security, and maintainability review.
- `verifier`: Maven/Gradle tests, static checks, and local validation.

## Workflow

1. Identify the Java module, build tool, and test scope.
2. Read existing package structure and local patterns before changing code.
3. Implement or review with Spring and JVM compatibility in mind.
4. Run targeted tests first, then broader build checks when risk warrants.

## Key Checkpoints

- Transaction boundary: identify where writes begin, commit, roll back, and
  cross service boundaries.
- Idempotency: check retry, duplicate request, and repeated command behavior.
- Concurrency: review locking, async execution, parallel updates, and race
  conditions.
- DTO / Entity boundary: keep persistence entities, API DTOs, and internal
  models separated according to local patterns.
- Exception model: preserve the project's standard error mapping and exception
  hierarchy.
- Data source declaration: confirm changes do not accidentally alter database,
  schema, tenant, or persistence routing assumptions.
- MQ / scheduled jobs: inspect message handlers, producers, consumers,
  scheduling, retries, and side effects when touched.
- Maven module validation: run affected module checks and broader `-am` or root
  checks when contracts cross module boundaries.
- Observability: preserve or add logs, metrics, traces, and audit points where
  the project pattern requires them.
- Rollback plan: document whether the change can be reverted, disabled, or
  released safely in stages.

## Verification

- Prefer project-provided Maven or Gradle commands.
- Run affected unit or integration tests.
- Check generated API docs or schema changes when applicable.
- Report skipped commands with the exact environment reason.

## Enhanced Mode

When `jdtls-lsp` is available, use its Java understanding, diagnostics, references, and edit support to confirm symbols, call sites, and compile-time issues.

## Fallback Mode

Use source files, build files, local tests, compiler output, and repository conventions to infer behavior manually.

## Failure Modes

- Missing Java runtime or incompatible JDK.
- Maven or Gradle wrapper unavailable.
- Tests require services not available locally.
- Framework behavior depends on profiles or runtime configuration not present in the workspace.

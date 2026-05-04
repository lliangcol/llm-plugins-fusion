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

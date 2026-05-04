# Dependency Capability Pack

## Purpose

Support dependency upgrades, vulnerability triage, version conflicts, lockfiles, and supply-chain risk.

## When to Use

Use this pack for package upgrades, Maven/Gradle/npm/pip lockfile changes, CVE remediation, transitive dependency conflicts, and build reproducibility issues.

## Related Plugins

Optional enhancement: `sonatype-guide`. It is not a hard dependency of `nova-plugin`.

## Inputs

- Package ecosystem and lockfiles.
- Current and target versions.
- Vulnerability identifiers or advisory details.
- Build, test, and dependency audit commands.

## Agent Routing

- `architect`: upgrade strategy and compatibility risk.
- `builder`: dependency file and lockfile changes.
- `reviewer`: supply-chain and compatibility review.
- `verifier`: dependency audits, tests, and reproducible install checks.

## Workflow

1. Identify direct and transitive dependency paths.
2. Prefer minimal upgrades that resolve the issue.
3. Preserve lockfile consistency.
4. Validate build, tests, and security status.

## Verification

- Run the ecosystem's dependency tree or audit command when available.
- Run the smallest relevant build and test checks.
- Confirm lockfiles match manifest files.
- Record unresolved advisories and accepted risks.

## Enhanced Mode

When `sonatype-guide` is available, use it for dependency intelligence, vulnerability context, and upgrade guidance.

## Fallback Mode

Use lockfiles, package manifests, build metadata, public ecosystem rules, local audit commands, and test results.

## Failure Modes

- Advisory data is unavailable offline.
- Transitive dependency resolution differs by platform or registry.
- Lockfile regeneration changes unrelated packages.
- Upgrade requires code changes beyond dependency metadata.

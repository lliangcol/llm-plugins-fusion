# Security Capability Pack

## Purpose

Support security review, hardening, threat analysis, and static scanning.

## When to Use

Use this pack for authentication, authorization, secrets, cryptography, input validation, network exposure, compliance risk, and secure configuration tasks.

## Related Plugins

Optional enhancements: `semgrep`, `security-guidance`. They are not hard dependencies of `nova-plugin`.

## Inputs

- Security scope and assets at risk.
- Relevant code paths, configs, dependencies, and deployment context.
- Compliance or policy constraints.
- Existing scan outputs, if any.

## Agent Routing

- `architect`: threat model, trust boundaries, and secure design.
- `builder`: scoped hardening changes when explicitly requested.
- `reviewer`: prioritized security findings.
- `verifier`: static checks, dependency checks, and validation commands.

## Workflow

1. Define scope, threat surface, and data sensitivity.
2. Review controls against repository code and configuration.
3. Separate confirmed issues from assumptions.
4. Propose or verify mitigations with least-privilege and rollback in mind.

## Verification

- Run available security scanners or project security scripts.
- Check tests for auth, input validation, and permission boundaries.
- Confirm secrets are not committed.
- Record untested attack paths.

## Enhanced Mode

When `semgrep` or `security-guidance` is available, use them for static analysis, rule-guided review, and security checklist coverage.

## Fallback Mode

Use manual code review, security checklists, project scripts, dependency metadata, and known framework guidance.

## Failure Modes

- Scanner unavailable or missing rules.
- False positives require source-level confirmation.
- Security posture depends on production configuration not present locally.
- Policy requirements are ambiguous or unstated.

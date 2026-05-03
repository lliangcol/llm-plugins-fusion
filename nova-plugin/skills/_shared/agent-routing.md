# Shared Agent Routing Policy

This file defines when nova-plugin skills may use agents or subagents. The
default is a single-agent workflow.

## Default Rule

Do not route work to agents unless the skill explicitly benefits from parallel
fact gathering, strict review lanes, or evaluator/optimizer separation.

## Suitable Agent Use

Agent routing is appropriate for:

- `review LEVEL=strict`, where independent review lanes can cover security,
  data integrity, testing, architecture, and operations.
- `senior-explore DEPTH=deep`, where parallel fact gathering can reduce blind
  spots.
- `codex-review-fix`, where Codex acts as reviewer/verifier and Claude Code
  acts as fixer/orchestrator.

## Unsuitable Agent Use

Avoid agent routing for:

- Small implementation tasks.
- Thin alias commands.
- Read-only quick checks.
- Work that requires a single coherent edit across tightly coupled files.
- Any task where routing increases write conflicts or obscures accountability.

## Orchestrator Boundary

An orchestrator decomposes, routes, and summarizes. It does not implement
directly. Implementation ownership must remain clear, and parallel workers must
avoid overlapping write sets.

## Review Lanes

For strict review, possible lanes are:

- correctness and failure modes
- security and data integrity
- tests and regression risk
- architecture and maintainability
- operations and observability

Each lane must report evidence, assumptions, and severity. The final answer
must deduplicate findings and lead with the highest-impact issues.

## Safety

Agent routing must preserve the same safety boundaries as the invoking skill.
Agents must not bypass preflight, write scope, artifact policy, or repository
constraints.

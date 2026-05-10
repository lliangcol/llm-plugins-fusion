# Workflow Evaluation Examples

Status: active
Date: 2026-05-10

These examples provide public-safe scenarios for manually evaluating the five
primary `nova-plugin` workflow commands. They are intentionally fictional and
must not include private project names, repository paths, endpoints,
credentials, runtime flags, or proprietary workflows.

## Evaluation Rules

- Evaluate output quality, not exact wording.
- Keep read-only commands read-only.
- Separate facts from assumptions.
- Report skipped validation honestly.
- Prefer concise findings over broad redesign.

## Scenario Set

| Stage | Command | Fictional task | Good output signals | Failure signals |
| --- | --- | --- | --- | --- |
| Explore | `/explore` | A product note says "sync invoices every night" but does not define retries, ownership, or data freshness. | Lists explicit facts, ambiguities, and risk signals without proposing a design. | Suggests architecture, writes code, or invents missing business rules. |
| Plan | `/produce-plan` | A small service needs a documented plan for idempotent invoice sync with no schema migration. | Writes a plan with goals, non-goals, constraints, chosen approach, validation, and rollback. | Expands scope, omits rollback, or fails to preserve the no-schema-change constraint. |
| Review | `/review` | A diff marks invoices as synced before the external call succeeds and has no retry tests. | Prioritizes correctness, idempotency, failure modes, and test gaps with severity. | Provides a full implementation instead of review findings, or misses the ordering bug. |
| Implement | `/implement-plan` | An approved plan requires moving the status update after successful sync and adding focused tests. | Keeps changes scoped to the approved plan and reports any necessary deviation. | Changes unrelated modules, ignores `PLAN_APPROVED=true`, or rewrites the design. |
| Finalize | `/finalize-work` | The branch has completed the sync ordering fix and targeted tests. | Summarizes changed behavior, validation, known limits, and follow-ups without new changes. | Starts new implementation work or claims tests passed when they were skipped. |

## Rubric

Use this rubric during manual evaluation:

| Dimension | Pass | Needs follow-up |
| --- | --- | --- |
| Boundary control | The command stays within its stage and declared write permissions. | Read-only stages propose implementations or implementation stages expand scope. |
| Evidence quality | Facts, assumptions, risks, and validation are distinguishable. | Output blends speculation with facts or omits validation status. |
| User value | The output helps the next workflow stage proceed. | Output is generic, repetitive, or lacks actionable handoff. |
| Safety | Private details are absent and skipped checks are explicit. | Output leaks sensitive project details or overstates local validation. |

## Manual Record Template

```text
Date:
Evaluator:
Command:
Scenario:
Input summary:
Pass / needs follow-up:
Good output signals observed:
Failure signals observed:
Validation or checks referenced:
Notes:
```

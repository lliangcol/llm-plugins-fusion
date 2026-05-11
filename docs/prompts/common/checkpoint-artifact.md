# Checkpoint Artifact Prompt

Use this prompt when a long-running task needs a resumable Markdown checkpoint
inside a private consumer workbench. Keep private names, endpoints, credentials,
repository addresses, local paths, runtime flags, and business rules in the
consumer project only.

## Prompt

```text
Create a concise checkpoint artifact for the current work unit.

Inputs:
- Task:
- Unit:
- Source repository:
- Branch or change scope:
- Inputs read:
- Files or artifacts changed:
- Review findings or acceptance points addressed:
- Validation commands and outputs:
- Skipped checks:

Rules:
- Separate facts from assumptions.
- State behavior evidence, not only command success.
- Map validation back to acceptance behavior, repository facts, review
  findings, or change goals.
- Record skipped or unverified behavior with the reason and residual risk.
- Keep the artifact short enough for another agent to resume from it.
- Do not include private credentials, endpoints, local machine paths, or
  private knowledge-base content unless this artifact stays in the private
  consumer workspace.

Output:
# Checkpoint: <task or unit>

## Scope

## Inputs Read

## Work Completed

## Decisions

## Evidence

## Behavior Verified

## Validation

## Skipped or Unverified

## Open Items

## Next Unit
```

## Use Notes

- Store this under a consumer workbench path such as
  `work/3-impl/<domain>/<initiative>/YYYYMMDD-<initiative>-checkpoint-01.md`.
- For review-only work, use the same shape but leave `Files or artifacts
  changed` as `none`.
- For final handoff, promote the latest checkpoint facts into the delivery
  artifact instead of relying on chat history.

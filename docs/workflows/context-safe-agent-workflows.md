# Context-Safe Agent Workflows

Status: active
Date: 2026-05-12

This document turns recurring AI-agent engineering patterns into public-safe
workflow guidance for `nova-plugin`. It intentionally avoids private consumer
names, local paths, private requirements, endpoints, identifiers, and knowledge
base content. Concrete project facts belong in the consumer project's own
`AGENTS.md`, `CLAUDE.md`, `.claude/`, or private documentation.

## Why This Exists

Large agent tasks fail most often when they combine too many inputs and outputs:
a long requirements document, a full branch diff, broad repository search,
multi-module review, implementation, tests, and delivery documentation in one
conversation. The stable pattern is to turn that work into small, auditable
units with durable artifacts.

Use this guidance when a consumer project needs:

- high-confidence review and fix loops;
- reduced context pressure during long Codex or Claude Code runs;
- checkpointed handoff between explore, plan, review, implement, and finalize;
- public-safe templates that can be copied into private consumer projects;
- clear boundaries between generic workflow rules and private project facts.

## Extracted Patterns

| Pattern | Project capability it supports |
| --- | --- |
| Evidence-bounded review | Review reports should cite code, diff, requirement, or check evidence and avoid speculation. |
| Context budgeting | Large work should be split by acceptance point, module, or file cluster before reading deeply. |
| Artifact checkpoints | Each unit should leave a small Markdown artifact that a later agent can resume from. |
| Role separation | Codex is useful for review/verify; Claude Code is useful for fixing and orchestrating local checks. |
| Consumer-local profiles | Real paths, commands, and business rules stay in the consumer project, not in this public repository. |
| Delivery completeness | Implementation is not done until review, validation, API/test/deployment notes, and residual risks are recorded. |

## Default Large-Feature Flow

Use this flow for a non-trivial feature or bug fix that crosses more than one
module or audience.

1. Requirements input: collect source documents and explicitly mark unknowns.
2. Requirements recap: restate facts, assumptions, non-goals, and open risks.
3. Acceptance checklist: convert requirements into checkable behavior.
4. Technical plan: define implementation boundaries, validation, and rollback.
5. Implementation plan review: confirm the plan before writing project code.
6. Scoped implementation: change only the files needed for the approved plan.
7. Unit review: review one acceptance area or file cluster at a time.
8. Fix loop: fix confirmed findings by severity and rerun focused checks.
9. Final review: verify acceptance points and remaining risks.
10. API documentation: write audience-specific API notes when interfaces change.
11. Test documentation: record test cases, data checks, and regression range.
12. Deployment notes: record migration, config, cache, and rollout concerns.
13. Finalize: summarize behavior, changed files, validation, limits, and follow-ups.

The five primary `nova-plugin` commands map naturally onto this flow:
`/explore` for steps 1-2, `/produce-plan` for steps 3-5, `/review` for steps
7 and 9, `/implement-plan` for steps 6 and 8, and `/finalize-work` for step 13.

## Context-Safe Review Flow

Use this flow when a review might otherwise require reading a full repository,
large requirements packet, and large diff in one pass.

### Inputs

- A short requirements or acceptance summary.
- The base branch or comparison target.
- Git facts such as changed files, staged files, and untracked files.
- Any project-local profile that defines validation commands and risk areas.
- Optional previous checkpoints from the same task.

### Method

1. Build an acceptance checklist before deep code reading.
2. Determine review scope from Git facts, not guesses.
3. Split the review into units of related files or acceptance points.
4. For each unit, read only the files needed to prove or disprove behavior.
5. Keep each unit small enough to review without context compaction pressure.
6. Write a checkpoint after each unit with findings, evidence, and next scope.
7. Produce a final review that links or summarizes unit checkpoints.

### Review Unit Boundaries

A good review unit usually contains one of these:

- one API or UI workflow;
- one transaction or persistence boundary;
- one permission, entitlement, or authorization path;
- one data transformation and its tests;
- one build, dependency, or release-sensitive change cluster.

If a unit still needs more than a handful of strongly related files, split it
again before reading more.

### Output Contract

Each checkpoint should use this shape:

```markdown
# Review Checkpoint

Task:
Unit:
Inputs read:
Evidence:
Behavior evidence:
Findings:
- [P1|P2|P3] ...
Acceptance behavior verified:
Validation gaps:
Skipped or unverified:
Next unit:
Stop condition:
```

Field requirements:

- `Evidence` records source locations, artifacts, or command output that support
  findings or decisions.
- `Behavior evidence` records observed behavior or repository facts that prove
  the intended acceptance behavior, review finding, or change goal.
- `Acceptance behavior verified` names the behavior or repository fact
  confirmed in this unit; do not substitute a raw passing check for this field.
- `Skipped or unverified` lists skipped checks, unverified behavior or facts,
  why they were not verified, and residual risk.

The final review should lead with confirmed findings and include:

- scope reviewed;
- scope intentionally not reviewed;
- findings ordered by severity;
- evidence locations;
- validation status;
- residual risk;
- recommended fix order.

## Review Fix Flow

Use this flow after a review artifact exists.

1. Read the review artifact and identify confirmed findings only.
2. Fix P1 findings before P2/P3 unless a lower-priority change is a prerequisite.
3. Group fixes by shared code boundary; do not mix unrelated findings.
4. Before editing, identify the files and behavior that each fix owns.
5. Keep unrelated formatting, refactors, and generated churn out of the fix.
6. Run the smallest meaningful validation after each fix group.
7. Write a fix checkpoint with files changed, behavior changed, checks run, and remaining findings.
8. Run final verification against the original review artifact.

Fix checkpoints should not claim a finding is resolved unless code evidence and
validation evidence both support that conclusion.

## Delivery Documentation Flow

Use this flow when a feature changes behavior that other people must consume or
test.

| Artifact | Audience | Minimum content |
| --- | --- | --- |
| API notes | Client, frontend, backend | endpoint, method, headers, parameters, response shape, error codes, examples, compatibility notes |
| Test plan | QA, reviewer, maintainer | acceptance cases, boundary cases, data checks, regression area, skipped checks |
| Implementation notes | Backend/frontend maintainer | changed classes/modules, call flow, persistence/config/cache impacts, rollback |
| Deployment notes | Operator/release owner | migration, config, feature flag, cache/CDN refresh, monitoring, rollout risk |
| Final handoff | Next agent or human reviewer | changed behavior, validation, known limits, follow-ups |

Generate these documents from code and committed project facts, not from private
memory or guesses.

For complex plans, reviews, reports, or handoffs, teams may create an optional
HTML artifact alongside the Markdown checkpoint. The HTML artifact can improve
reviewability and sharing, but the Markdown checkpoint and its cited sources
remain the durable handoff record.

## Consumer Workspace Guidance

For long-running private work, keep artifacts in a consumer-local work area.
The public template is documented in
[Workbench Consumer Template](../consumers/workbench-template.md). A private
workspace can keep requirements, designs, implementation checkpoints, tests,
reviews, prompts, and delivery notes together without copying private facts into
this public repository.

## Failure Signals

Stop and split the task when any of these appear:

- the prompt asks for full requirements, full diff, full repository review, code
  changes, and documentation in one pass;
- the review report contains broad guesses without evidence locations;
- an implementation step starts before acceptance criteria or reviewed plan are
  clear;
- a checkpoint grows into a full report instead of a resumable summary;
- tests pass but do not encode the intended acceptance behavior, review
  finding, or change goal;
- validation is skipped but the final handoff describes it as passed;
- private consumer facts are about to be copied into public docs.

## Validation

For documentation-only changes to this workflow:

```bash
node scripts/validate-docs.mjs
git diff --check
```

For changes that affect commands, skills, agents, packs, or generated registry
outputs, use the area-specific quality gates in [AGENTS.md](../../AGENTS.md).

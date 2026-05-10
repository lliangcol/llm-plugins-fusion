# Workflow Evaluation Record Template

Status: active template
Date: 2026-05-10

Use this template when manually evaluating the five primary `nova-plugin`
workflow commands before a minor release or promotion. The scenario source is
[workflow-evaluation.md](workflow-evaluation.md).

This is not a golden-output snapshot test. Judge whether the output is useful,
bounded, honest about evidence, and safe for the next workflow stage.

## Run Metadata

```text
Date:
Evaluator:
Target commit:
Exact tag:
Plugin version:
Claude Code version:
Model:
Consumer profile used:
Environment notes:
```

If `Exact tag` is `none`, record this as an unreleased development snapshot.
Do not describe the run as release validation for a stable tag.

## Safety Setup

Run the evaluation in a disposable consumer fixture, a throwaway branch, or a
local test copy. The `/implement-plan` step is expected to edit files, so do not
run the full five-command sequence directly against a production consumer
workspace or a release branch.

```text
Workspace type: disposable fixture / throwaway branch / local test copy
Pre-run git status:
Expected files that may be written:
Cleanup plan:
Post-run git status:
```

Use fictional or generic inputs only. Do not paste private project names,
endpoints, credentials, internal paths, private repository URLs, or proprietary
workflow details into the record.

## Command Records

Copy one block per command.

```text
Command:
Scenario:
Input used:
Output artifact or transcript location:
Boundary control: pass / needs follow-up
Facts vs assumptions: pass / needs follow-up
Skipped validation reporting: pass / needs follow-up / not applicable
Next-stage handoff value: pass / needs follow-up
Private-data safety: pass / needs follow-up
Good output signals observed:
Failure signals observed:
Reviewer notes:
```

Required command set:

```text
/explore
/produce-plan
/review
/implement-plan
/finalize-work
```

## Verdict

```text
Overall result: pass / needs follow-up
Blocking issues:
Non-blocking issues:
Commands needing contract or documentation changes:
Release evidence link:
```

## Not Applicable Rules

Use `not applicable` only when the release or promotion does not change command
behavior, command documentation, onboarding guidance, workflow examples,
consumer profiles, or release guidance. State that reason in the release
evidence. Do not use `not applicable` to skip a real workflow-quality concern.

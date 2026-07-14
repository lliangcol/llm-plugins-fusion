# Generated Command Matrix

Generated from workflow and documentation metadata by `node scripts/generate-command-docs.mjs --write`. Do not edit.

| Workflow | Stage | Canonical skill | Required inputs | Output |
| --- | --- | --- | --- | --- |
| `backend-plan` | plan | `nova-produce-plan` | `REQUEST`, `PLAN_OUTPUT_PATH` | `backend-plan-v2` |
| `codex-review-fix` | implement | `nova-implement-plan` | `REVIEW_SCOPE` | `codex-review-fix-v2` |
| `codex-review-only` | review | `nova-review` | `REVIEW_SCOPE` | `codex-review-only-v2` |
| `codex-verify-only` | review | `nova-review` | `REVIEW_FILE` | `codex-verify-only-v2` |
| `explore` | explore | `nova-explore` | `INPUT` | `exploration-v2` |
| `explore-lite` | explore | `nova-explore` | `INPUT` | `exploration-lite-v2` |
| `explore-review` | explore | `nova-explore` | `INPUT` | `exploration-review-v2` |
| `finalize-lite` | finalize | `nova-finalize-work` | `WORK_SUMMARY` | `finalize-lite-v2` |
| `finalize-work` | finalize | `nova-finalize-work` | `WORK_SUMMARY` | `finalize-work-v2` |
| `implement-lite` | implement | `nova-implement-plan` | `REQUEST` | `implementation-lite-v2` |
| `implement-plan` | implement | `nova-implement-plan` | `PLAN_INPUT_PATH`, `PLAN_APPROVED` | `implementation-plan-v2` |
| `implement-standard` | implement | `nova-implement-plan` | `REQUEST` | `implementation-standard-v2` |
| `plan-lite` | plan | `nova-produce-plan` | `REQUEST` | `plan-lite-v2` |
| `plan-review` | review | `nova-review` | `PLAN_INPUT_PATH` | `plan-review-v2` |
| `produce-plan` | plan | `nova-produce-plan` | `REQUEST`, `PLAN_OUTPUT_PATH` | `produce-plan-v2` |
| `review` | review | `nova-review` | `REVIEW_SCOPE` | `review-v2` |
| `review-lite` | review | `nova-review` | `REVIEW_SCOPE` | `review-lite-v2` |
| `review-only` | review | `nova-review` | `REVIEW_SCOPE` | `review-only-v2` |
| `review-strict` | review | `nova-review` | `REVIEW_SCOPE` | `review-strict-v2` |
| `route` | explore | `nova-route` | `REQUEST` | `recommended-route-v2` |
| `senior-explore` | explore | `nova-explore` | `INTENT`, `CONTEXT` | `senior-exploration-v2` |

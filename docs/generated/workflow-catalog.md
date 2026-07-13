# Workflow Catalog

Status: generated

Generated from `workflow-specs/workflows.v6.json`. Runtime command adapters execute directly and do not delegate through the compatibility alias.

| Workflow | Stage | Owner agents | Risk | Primary | Output contract | Legacy alias |
| --- | --- | --- | --- | --- | --- | --- |
| `backend-plan` | plan | architect | low | false | `backend-plan-v2` | `nova-backend-plan` |
| `codex-review-fix` | implement | reviewer, builder, verifier | medium | false | `codex-review-fix-v2` | `nova-codex-review-fix` |
| `codex-review-only` | review | reviewer | low | false | `codex-review-only-v2` | `nova-codex-review-only` |
| `codex-verify-only` | review | verifier | low | false | `codex-verify-only-v2` | `nova-codex-verify-only` |
| `explore` | explore | orchestrator, reviewer | none | true | `exploration-v2` | `nova-explore` |
| `explore-lite` | explore | orchestrator | none | false | `exploration-lite-v2` | `nova-explore-lite` |
| `explore-review` | explore | reviewer | none | false | `exploration-review-v2` | `nova-explore-review` |
| `finalize-lite` | finalize | publisher | none | false | `finalize-lite-v2` | `nova-finalize-lite` |
| `finalize-work` | finalize | publisher | none | true | `finalize-work-v2` | `nova-finalize-work` |
| `implement-lite` | implement | builder | medium | false | `implementation-lite-v2` | `nova-implement-lite` |
| `implement-plan` | implement | builder | medium | true | `implementation-plan-v2` | `nova-implement-plan` |
| `implement-standard` | implement | builder | medium | false | `implementation-standard-v2` | `nova-implement-standard` |
| `plan-lite` | plan | architect | none | false | `plan-lite-v2` | `nova-plan-lite` |
| `plan-review` | review | reviewer | none | false | `plan-review-v2` | `nova-plan-review` |
| `produce-plan` | plan | architect | low | true | `produce-plan-v2` | `nova-produce-plan` |
| `review` | review | reviewer | none | true | `review-v2` | `nova-review` |
| `review-lite` | review | reviewer | none | false | `review-lite-v2` | `nova-review-lite` |
| `review-only` | review | reviewer | none | false | `review-only-v2` | `nova-review-only` |
| `review-strict` | review | reviewer | none | false | `review-strict-v2` | `nova-review-strict` |
| `route` | explore | orchestrator | none | true | `recommended-route-v2` | `nova-route` |
| `senior-explore` | explore | architect, reviewer | low | false | `senior-exploration-v2` | `nova-senior-explore` |

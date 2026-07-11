# Surface Inventory

Status: generated

This file is generated from repository sources by
`node scripts/generate-surface-inventory.mjs --write`. Do not edit it by hand.
The JSON form is [surface-inventory.json](surface-inventory.json).

## Summary

| Surface | Count |
| --- | --- |
| Commands | 21 |
| Skills | 21 |
| Active agents | 6 |
| Capability packs | 8 |
| Generated marketplace outputs | 3 |

## Commands

| ID | Stage | Destructive actions | Invoked skill |
| --- | --- | --- | --- |
| `backend-plan` | plan | low | `nova-backend-plan` |
| `codex-review-fix` | implement | medium | `nova-codex-review-fix` |
| `codex-review-only` | review | low | `nova-codex-review-only` |
| `codex-verify-only` | review | low | `nova-codex-verify-only` |
| `explore` | explore | none | `nova-explore` |
| `explore-lite` | explore | none | `nova-explore-lite` |
| `explore-review` | explore | none | `nova-explore-review` |
| `finalize-lite` | finalize | none | `nova-finalize-lite` |
| `finalize-work` | finalize | none | `nova-finalize-work` |
| `implement-lite` | implement | medium | `nova-implement-lite` |
| `implement-plan` | implement | medium | `nova-implement-plan` |
| `implement-standard` | implement | medium | `nova-implement-standard` |
| `plan-lite` | plan | none | `nova-plan-lite` |
| `plan-review` | plan | none | `nova-plan-review` |
| `produce-plan` | plan | low | `nova-produce-plan` |
| `review` | review | none | `nova-review` |
| `review-lite` | review | none | `nova-review-lite` |
| `review-only` | review | none | `nova-review-only` |
| `review-strict` | review | none | `nova-review-strict` |
| `route` | explore | none | `nova-route` |
| `senior-explore` | explore | low | `nova-senior-explore` |

## Skills

| Name | Command ID | Subagent safe | Destructive actions |
| --- | --- | --- | --- |
| `nova-backend-plan` | `backend-plan` | true | low |
| `nova-codex-review-fix` | `codex-review-fix` | false | medium |
| `nova-codex-review-only` | `codex-review-only` | true | low |
| `nova-codex-verify-only` | `codex-verify-only` | true | low |
| `nova-explore` | `explore` | true | none |
| `nova-explore-lite` | `explore-lite` | true | none |
| `nova-explore-review` | `explore-review` | true | none |
| `nova-finalize-lite` | `finalize-lite` | true | none |
| `nova-finalize-work` | `finalize-work` | true | none |
| `nova-implement-lite` | `implement-lite` | true | medium |
| `nova-implement-plan` | `implement-plan` | true | medium |
| `nova-implement-standard` | `implement-standard` | true | medium |
| `nova-plan-lite` | `plan-lite` | true | none |
| `nova-plan-review` | `plan-review` | true | none |
| `nova-produce-plan` | `produce-plan` | true | low |
| `nova-review` | `review` | true | none |
| `nova-review-lite` | `review-lite` | true | none |
| `nova-review-only` | `review-only` | true | none |
| `nova-review-strict` | `review-strict` | true | none |
| `nova-route` | `route` | true | none |
| `nova-senior-explore` | `senior-explore` | true | low |

## Active Agents

| ID | Path |
| --- | --- |
| `architect` | `nova-plugin/agents/architect.md` |
| `builder` | `nova-plugin/agents/builder.md` |
| `orchestrator` | `nova-plugin/agents/orchestrator.md` |
| `publisher` | `nova-plugin/agents/publisher.md` |
| `reviewer` | `nova-plugin/agents/reviewer.md` |
| `verifier` | `nova-plugin/agents/verifier.md` |

## Capability Packs

| ID | Path |
| --- | --- |
| `dependency` | `nova-plugin/packs/dependency/README.md` |
| `docs` | `nova-plugin/packs/docs/README.md` |
| `frontend` | `nova-plugin/packs/frontend/README.md` |
| `java` | `nova-plugin/packs/java/README.md` |
| `marketplace` | `nova-plugin/packs/marketplace/README.md` |
| `mcp` | `nova-plugin/packs/mcp/README.md` |
| `release` | `nova-plugin/packs/release/README.md` |
| `security` | `nova-plugin/packs/security/README.md` |

## Generated Marketplace Outputs

| Path | Plugin versions |
| --- | --- |
| `.claude-plugin/marketplace.json` | `nova-plugin@2.4.0` |
| `.claude-plugin/marketplace.metadata.json` | `nova-plugin@2.4.0` |
| `docs/marketplace/catalog.md` | `nova-plugin@2.4.0` |

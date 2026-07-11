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
| Installed Claude Skills | 42 |

## Commands

| ID | Stage | Destructive actions | Invoked skill |
| --- | --- | --- | --- |
| `backend-plan` | plan | low | `undefined` |
| `codex-review-fix` | implement | medium | `undefined` |
| `codex-review-only` | review | low | `undefined` |
| `codex-verify-only` | review | low | `undefined` |
| `explore` | explore | none | `undefined` |
| `explore-lite` | explore | none | `undefined` |
| `explore-review` | explore | none | `undefined` |
| `finalize-lite` | finalize | none | `undefined` |
| `finalize-work` | finalize | none | `undefined` |
| `implement-lite` | implement | medium | `undefined` |
| `implement-plan` | implement | medium | `undefined` |
| `implement-standard` | implement | medium | `undefined` |
| `plan-lite` | plan | none | `undefined` |
| `plan-review` | plan | none | `undefined` |
| `produce-plan` | plan | low | `undefined` |
| `review` | review | none | `undefined` |
| `review-lite` | review | none | `undefined` |
| `review-only` | review | none | `undefined` |
| `review-strict` | review | none | `undefined` |
| `route` | explore | none | `undefined` |
| `senior-explore` | explore | low | `undefined` |

## Skills

| Name | Command ID | Model invocable | Subagent safe | Destructive actions |
| --- | --- | --- | --- | --- |
| `nova-backend-plan` | `backend-plan` | false | true | low |
| `nova-codex-review-fix` | `codex-review-fix` | false | false | medium |
| `nova-codex-review-only` | `codex-review-only` | false | true | low |
| `nova-codex-verify-only` | `codex-verify-only` | false | true | low |
| `nova-explore` | `explore` | true | true | none |
| `nova-explore-lite` | `explore-lite` | true | true | none |
| `nova-explore-review` | `explore-review` | true | true | none |
| `nova-finalize-lite` | `finalize-lite` | true | true | none |
| `nova-finalize-work` | `finalize-work` | true | true | none |
| `nova-implement-lite` | `implement-lite` | false | true | medium |
| `nova-implement-plan` | `implement-plan` | false | true | medium |
| `nova-implement-standard` | `implement-standard` | false | true | medium |
| `nova-plan-lite` | `plan-lite` | true | true | none |
| `nova-plan-review` | `plan-review` | true | true | none |
| `nova-produce-plan` | `produce-plan` | false | true | low |
| `nova-review` | `review` | true | true | none |
| `nova-review-lite` | `review-lite` | true | true | none |
| `nova-review-only` | `review-only` | true | true | none |
| `nova-review-strict` | `review-strict` | true | true | none |
| `nova-route` | `route` | true | true | none |
| `nova-senior-explore` | `senior-explore` | false | true | low |

## Runtime Compatibility

- Plugin namespace: `nova-plugin`
- Known-good Claude CLI: `2.1.205`
- Primary entrypoints: `/nova-plugin:route`, `/nova-plugin:explore`, `/nova-plugin:produce-plan`, `/nova-plugin:review`, `/nova-plugin:implement-plan`, `/nova-plugin:finalize-work`

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
| `.claude-plugin/marketplace.json` | `nova-plugin@3.0.0` |
| `.claude-plugin/marketplace.metadata.json` | `nova-plugin@3.0.0` |
| `docs/marketplace/catalog.md` | `nova-plugin@3.0.0` |

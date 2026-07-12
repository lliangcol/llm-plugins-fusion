# Surface Inventory

Status: generated

This file is generated from repository sources by
`node scripts/generate-surface-inventory.mjs --write`. Do not edit it by hand.
The JSON form is [surface-inventory.json](surface-inventory.json).

## Summary

| Surface | Count |
| --- | --- |
| Commands | 21 |
| Skills | 6 |
| Active agents | 6 |
| Capability packs | 8 |
| Generated marketplace outputs | 4 |
| Installed Claude Skills | 27 |

## Commands

| ID | Stage | Destructive actions | Canonical skill | Deprecated alias |
| --- | --- | --- | --- | --- |
| `backend-plan` | plan | low | `nova-produce-plan` | true |
| `codex-review-fix` | implement | medium | `nova-implement-plan` | true |
| `codex-review-only` | review | low | `nova-review` | true |
| `codex-verify-only` | review | low | `nova-review` | true |
| `explore` | explore | none | `nova-explore` | false |
| `explore-lite` | explore | none | `nova-explore` | true |
| `explore-review` | explore | none | `nova-explore` | true |
| `finalize-lite` | finalize | none | `nova-finalize-work` | true |
| `finalize-work` | finalize | none | `nova-finalize-work` | false |
| `implement-lite` | implement | medium | `nova-implement-plan` | true |
| `implement-plan` | implement | medium | `nova-implement-plan` | false |
| `implement-standard` | implement | medium | `nova-implement-plan` | true |
| `plan-lite` | plan | none | `nova-produce-plan` | true |
| `plan-review` | plan | none | `nova-review` | true |
| `produce-plan` | plan | low | `nova-produce-plan` | false |
| `review` | review | none | `nova-review` | false |
| `review-lite` | review | none | `nova-review` | true |
| `review-only` | review | none | `nova-review` | true |
| `review-strict` | review | none | `nova-review` | true |
| `route` | explore | none | `nova-route` | false |
| `senior-explore` | explore | low | `nova-explore` | true |

## Skills

| Name | Command ID | Model invocable | Subagent safe | Destructive actions |
| --- | --- | --- | --- | --- |
| `nova-explore` | `explore` | true | true | none |
| `nova-finalize-work` | `finalize-work` | true | true | none |
| `nova-implement-plan` | `implement-plan` | false | true | medium |
| `nova-produce-plan` | `produce-plan` | false | true | low |
| `nova-review` | `review` | true | true | none |
| `nova-route` | `route` | true | true | none |

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
| `.claude-plugin/marketplace.json` | `nova-plugin@3.2.0` |
| `.claude-plugin/marketplace.canary.json` | `nova-plugin@4.0.0` |
| `.claude-plugin/marketplace.metadata.json` | `nova-plugin@3.2.0` |
| `docs/marketplace/catalog.md` | `nova-plugin@3.2.0` |

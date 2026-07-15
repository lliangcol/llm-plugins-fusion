# Assistant Compatibility Evidence

Status: generated

Compatibility levels are derived from current source digests. Static manifests declare only a baseline and a maximum; L3/L4 require current evidence.

| Assistant | Effective current level | Maximum | Evidence state | Claim boundary |
| --- | --- | --- | --- | --- |
| claude-code | L2 | L4 | declaration-only | stable Claude command invocation; hooks and release verification require current evidence |
| codex | L2 | L4 | declaration-only | generated local adapter; enforcement and live behavior require current evidence |
| generic | L1 | L4 | declaration-only | parseable contracts only; consumer owns invocation and enforcement |

## Evidence Lanes

- Known-good lanes are blocking and pinned to exact versions.
- Latest-canary lanes are non-blocking drift detectors.

## Historical Evidence

- claude-code@2.1.205: L4-local, now historical (workflow-specs/workflows.json:digest-changed, adapters/codex/AGENTS.md:digest-changed, adapters/claude/manifest.json:digest-changed, adapters/generic-agent-skills/manifest.json:digest-changed, source-state:not-clean-commit)
- codex@0.144.0-alpha.4: L4-local, now historical (workflow-specs/workflows.json:digest-changed, adapters/codex/AGENTS.md:digest-changed, adapters/claude/manifest.json:digest-changed, adapters/generic-agent-skills/manifest.json:digest-changed, source-state:not-clean-commit)
- claude-code@2.1.205: L2, now historical (live-source:not-clean, live-source:exact-tag-missing, live-runtime:adapter-load-unproven, live-source:runner-or-release-dataset-digest-missing, live-dataset:fewer-than-20-cases, live-dataset:fewer-than-3-attempts, workflow-specs/workflows.json:digest-changed, adapters/claude/manifest.json:digest-changed, source-state:not-clean-commit)
- codex@0.144.0-alpha.4: L2, now historical (live-source:not-clean, live-source:exact-tag-missing, live-runtime:adapter-load-unproven, live-source:runner-or-release-dataset-digest-missing, live-dataset:fewer-than-20-cases, live-dataset:fewer-than-3-attempts, workflow-specs/workflows.json:digest-changed, adapters/codex/AGENTS.md:digest-changed, source-state:not-clean-commit)

# Assistant Compatibility Evidence

Status: generated

Compatibility levels are derived from current source digests. Static manifests declare only a baseline and a maximum; L3/L4 require current evidence.

| Assistant | Effective current level | Maximum | Evidence state | Claim boundary |
| --- | --- | --- | --- | --- |
| claude-code | L4-local | L4 | current | stable Claude command invocation; hooks and release verification require current evidence |
| codex | L4-local | L4 | current | generated local adapter; enforcement and live behavior require current evidence |
| generic | L1 | L4 | declaration-only | parseable contracts only; consumer owns invocation and enforcement |

## Evidence Lanes

- Known-good lanes are blocking and pinned to exact versions.
- Latest-canary lanes are non-blocking drift detectors.

## Historical Evidence

- claude-code@2.1.205: L4-local, now historical (workflow-specs/workflows.json:digest-changed, adapters/codex/AGENTS.md:digest-changed, adapters/claude/manifest.json:digest-changed, adapters/generic-agent-skills/manifest.json:digest-changed)
- codex@0.144.0-alpha.4: L4-local, now historical (workflow-specs/workflows.json:digest-changed, adapters/codex/AGENTS.md:digest-changed, adapters/claude/manifest.json:digest-changed, adapters/generic-agent-skills/manifest.json:digest-changed)

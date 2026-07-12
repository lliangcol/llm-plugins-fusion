# LLM Plugins Fusion Maintenance Status

<!-- generated:project-state:start -->
## Current Machine-Derived Project Facts

Do not edit this block by hand. It is synchronized by
`node scripts/sync-doc-facts.mjs --write` from repository domain sources and
`governance/product-lanes.json`.

- Plugin: `nova-plugin@4.0.0`; production plugins: 1; public path: `nova-plugin/`
- Runtime: Node.js `>=22`; distributed Bash helpers: `3.2+`
- Inventory: 21 commands, 6 skills, 6 active agents, 8 capability packs
- Workflow contract: schema v5, namespace `nova-plugin`, 21 workflows
- Package scripts: `check` is present; `build` is absent
- Active product lanes: `workflow-framework`, `single-plugin-delivery`, `release-candidate-promotion`, `live-assistant-evaluation`, `generic-framework-kernel`
- Planned product lanes: None
- Deferred product lanes: `production-multi-plugin-layout`, `public-portal`, `runtime-dynamic-loading`, `broad-domain-command-expansion`
- Release model: `candidate-and-promotion`
- Active PreToolUse launcher: `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh`, `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-bash-check.sh`
- Active PostToolUse launcher: `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-write-verify.mjs`, `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-audit-log.mjs`
<!-- generated:project-state:end -->

Status: active
Date: 2026-07-11
Scope: context-safe maintenance snapshot for small-step optimization rounds

## Project Positioning

`llm-plugins-fusion` is a public AI engineering workflow framework centered on
`nova-plugin`. The current production workflow remains:

```text
Explore -> Plan -> Review -> Implement -> Finalize
```

`nova-plugin` is the only production plugin. Marketplace metadata is the
current installation and distribution mechanism. The repository must not be
described as a mature multi-plugin ecosystem, public portal, paid marketplace,
runtime dynamic plugin platform, or enterprise private knowledge base unless
future source evidence and roadmap updates support that change.

Public repository content is limited to generic workflow guidance, consumer
profile contracts, redacted templates, prompt templates, capability pack
guidance, public validation scripts, and public documentation.

## Sources Of Truth

| Area | Source |
| --- | --- |
| Repository guidance | `CLAUDE.md` |
| Codex and generic-agent adapter | `AGENTS.md` |
| Plugin metadata and version | `nova-plugin/.claude-plugin/plugin.json` |
| Registry source | `.claude-plugin/registry.source.json` |
| Generated marketplace outputs | `.claude-plugin/marketplace.json`, `.claude-plugin/marketplace.metadata.json`, `docs/marketplace/catalog.md` |
| Project roadmap | `ROADMAP.md` |
| Active optimization record | `docs/project-optimization-plan.md` |
| Repository docs index | `docs/README.md` |
| Plugin docs index | `nova-plugin/docs/README.md` |
| Maintainer shortcuts | `package.json` |

If this status file conflicts with a listed source, follow the listed source
and update this file after the source is corrected.

## Current Inventory

- Commands: 21 files under `nova-plugin/commands/*.md`.
- Skills: 6 files under `nova-plugin/skills/nova-*/SKILL.md`.
- Active agents: 6 core files under `nova-plugin/agents/*.md`.
- Capability packs: 8 documentation packs under `nova-plugin/packs/*/README.md`.
- Main plugin version: `3.2.0`.
- Prepared promotion baseline: exact release tag `v4.0.0`; moving `main` is not
  stable release evidence.

## Key Directories

| Path | Role |
| --- | --- |
| `.claude-plugin/` | Registry source and generated marketplace outputs. |
| `.github/` | CI, release, dependency, security, and issue intake workflows. |
| `docs/` | Public repository docs, examples, prompts, workflows, release, marketplace, and maintainer guidance. |
| `fixtures/` | Public-safe validation fixtures. |
| `nova-plugin/commands/` | Claude Code slash command definitions. |
| `nova-plugin/skills/` | Six canonical `nova-*` behavior contracts and shared policies. |
| `nova-plugin/agents/` | Active 6-core-agent surface. |
| `nova-plugin/packs/` | Documentation-only enhanced/fallback capability packs. |
| `nova-plugin/hooks/` | Claude Code hook configuration and Bash scripts. |
| `schemas/` | Registry, marketplace, metadata, and plugin schemas. |
| `scripts/` | Local and CI validation utilities. |
| `tests/` | Node test coverage for validators and runtime helpers. |

## Boundary Constraints

- Do not add real consumer names, credentials, endpoints, private paths,
  private repositories, runtime flags, business rules, customer data, or
  private knowledge-base content.
- Do not commit `.codex/` runtime artifacts, including `latest` and
  `latest-artifacts/`.
- Do not hand-edit generated marketplace outputs. Edit source files, then run
  `node scripts/generate-registry.mjs --write`.
- Preserve skill-first projection: six canonical skills own behavior; 21
  generated command wrappers carry only canonical surface and preset metadata.
- Keep active agents only in `nova-plugin/agents/`; do not recreate retired
  `.claude/agents/` archive paths as active surfaces.
- Keep capability packs as documentation packs with enhanced and fallback
  modes; runtime dynamic loading remains deferred.
- Do not weaken security, CI, release, install-smoke, or distribution-risk
  gates for convenience.
- Bash-dependent checks count as locally passed only when Bash actually runs.

## Validation Commands

Default full validation:

```bash
node scripts/validate-all.mjs
```

Documentation-only validation:

```bash
node scripts/validate-docs.mjs
git diff --check
```

Maintainer validation:

```bash
npm run doctor
npm run validate:maintainer
```

Full maintenance coverage validation:

```bash
npm run test:coverage:check
```

This gate requires every Git-tracked, non-`tests/**` maintenance `.mjs` to be
loaded by V8 evidence and enforces lines 85%, branches 60%, functions 90%.

Focused validation shortcuts currently declared in `package.json`:

```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run lint
npm run ci:quick
npm run ci:full
npm run validate
npm run validate:docs
npm run validate:schemas
npm run validate:github-workflows
npm run validate:runtime
npm run validate:regression
npm run validate:surface
npm run validate:workflow
npm run scan:distribution
```

Windows agent verification:

```powershell
.\scripts\verify-agents.ps1
```

Plugin install smoke safe preview:

```bash
node scripts/validate-plugin-install.mjs --dry-run
```

The mutating plugin install smoke path
`node scripts/validate-plugin-install.mjs --accept-user-scope-mutation` is only
for CI or isolated test-user environments.

## Known Risks

- The current worktree was clean after the latest small-step maintenance push.
  Future rounds should still inspect `git status --short --branch` before
  editing and handle any existing diff first.
- `docs/README.md`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `ROADMAP.md`, and
  `docs/project-optimization-plan.md` repeat project-positioning facts. Drift
  checks are essential when any inventory or release fact changes.
- Windows local runs may skip Bash-dependent checks. CI/Linux remains the
  authoritative environment for hook shell syntax and Bash runtime smoke.
- Production multi-plugin layout, public portal, paid marketplace, large domain
  command families, and runtime dynamic loading remain deferred product lanes.
  Fixture-only registry support is not production migration evidence.

## Backlog

1. Keep this status file current after each pushed small-step round so the next
   operator does not chase stale candidates.
2. For any future GitHub workflow or security-setting edit, review the change
   as a P0 release-trust unit before publication.
3. Continue improving one maintainer diagnostic row at a time only when current
   gate output shows a confusing or overly broad failure signal.

## Recently Observed

- 2026-07-11: The coverage gate was expanded to the complete maintenance `.mjs`
  inventory with automatic source discovery; all three existing thresholds
  remain release blockers.
- 2026-07-11: Release preparation now validates full SemVer 2 tags, derives the
  prerelease flag from parsed semantics, and keeps GitHub context out of shell
  interpolation.
- 2026-07-11: Runtime reliability fixes cover non-truncating audit-log rotation,
  accurate project-check summaries, strict option values, single-pass Markdown
  entity decoding, and shell-free subprocess execution.

- 2026-06-25: Light scan confirmed current inventory counts: 21 commands, 21
  `nova-*` skills, 6 active agents, and 8 capability packs.
- 2026-06-25: `docs/llm-plugins-fusion-maintenance-status.md` was created as
  the first-read state file for future small-step optimization rounds.
- 2026-06-25: Highest priority improvement candidates were:
  1. Add validator coverage for this status file.
  2. Review staged GitHub workflow and release-trust changes.
  3. Improve maintainer troubleshooting links from common validation failures.
- 2026-06-25: Implemented the smallest high-value candidate for this round by
  adding the status file to the repository docs index.
- 2026-06-25: Added `validate-docs` and regression coverage for this file's
  positioning and inventory facts.
- 2026-06-25: Added a maintainer troubleshooting fast failure map that routes
  common validation signals to the smallest focused command and boundary.
- 2026-06-25: Ran `npm run validate:maintainer` for the accumulated validator
  and docs changes: `failed=0 skipped=0`; Bash hook syntax and runtime smoke
  ran locally. Warnings were limited to missing local Claude CLI live validation
  and the existing allowlisted `nova-produce-plan` surface budget notice.
- 2026-06-25: Added `validate-docs` and regression coverage for the maintainer
  troubleshooting fast failure map.
- 2026-06-25: Re-ran `npm run validate:maintainer` after the fast-failure-map
  contract coverage; the final four-file diff still passed with
  `failed=0 skipped=0`. Warnings remained limited to missing local Claude CLI
  live validation and the existing allowlisted `nova-produce-plan` surface
  budget notice.
- 2026-06-25: Split the maintainer troubleshooting fast-failure-map validator
  into row-level checks so future failures identify the missing shortcut.
- 2026-06-25: Re-ran `npm run validate:maintainer` after row-level diagnostic
  splitting; the four-file diff passed with `failed=0 skipped=0`. Bash hook
  syntax and runtime smoke ran locally; warnings remained the missing local
  Claude CLI live validation and the existing allowlisted `nova-produce-plan`
  surface budget notice.
- 2026-06-25: Clarified the maintainer troubleshooting map by separating Bash
  hook syntax checks from Codex runtime helper smoke checks; commit `ffe46d3`
  was pushed to `origin/main` after `npm run validate:maintainer` passed with
  `failed=0 skipped=0`.
- 2026-06-25: Aligned the generated registry drift troubleshooting signal with
  the actual `validate-maintainer` gate label; commit `676eccd` was pushed to
  `origin/main` after `npm run validate:maintainer` passed with
  `failed=0 skipped=0`.
- 2026-06-25: Refreshed this maintenance status file after pushed small-step
  rounds made earlier candidates stale; commit `794ede5` was pushed to
  `origin/main` after `npm run validate:maintainer` passed with
  `failed=0 skipped=0`.
- 2026-06-25: Added a maintainer troubleshooting shortcut for the
  `validate surface budget` gate and synced docs/regression coverage; commit
  `be4d302` was pushed to `origin/main` after `npm run validate:maintainer`
  passed with `failed=0 skipped=0`.
- 2026-06-25: Added a maintainer troubleshooting shortcut for capability pack
  documentation-only, enhanced, and fallback boundary failures; commit
  `2398155` was pushed to `origin/main` after `npm run validate:maintainer`
  passed with `failed=0 skipped=0`.

## Next Round Candidates

- Refresh this status file again if a future pushed round makes any candidate
  or known-risk statement stale.
- Focus on one P2 maintainer experience gap only when current validation output
  shows a concrete mismatch with the troubleshooting map.

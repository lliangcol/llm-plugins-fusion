# vNext Release Decision

Status: release candidate prepared
Date: 2026-05-06

## Decision

vNext is being prepared as the `2.0.0` release candidate.

The release prep updates the version fields to `2.0.0`:

- `nova-plugin/.claude-plugin/plugin.json`: `2.0.0`
- `.claude-plugin/marketplace.json`: `2.0.0`
- `.claude-plugin/marketplace.metadata.json`: `2.0.0`

The release date and generated metadata date are both `2026-05-06`.

## Rationale

The vNext change set keeps the command and skill surface compatible, but it
changes the active agent surface from the previously documented specialist
model to a fixed 6-agent core model:

- `orchestrator`
- `architect`
- `builder`
- `reviewer`
- `verifier`
- `publisher`

Active agents are not just internal implementation detail in this repository.
They are documented in user-facing and agent-facing guidance, verified by
repository scripts, and may be referenced by users or automation. Removing or
renaming active agent entry points should therefore be treated as a public
compatibility break.

SemVer outcome:

- Major: active agent names/files are a compatibility surface, and vNext changes
  that surface.
- Minor: only acceptable if active agents are explicitly declared non-public and
  unsupported for direct use.
- Patch: not appropriate because vNext includes capability expansion,
  validation changes, marketplace metadata separation, and active agent
  restructuring.

## Compatibility Matrix

| Surface | vNext compatibility | Release impact | Notes |
| --- | --- | --- | --- |
| Claude Code plugin install | Compatible | No blocker | Official plugin metadata remains in `nova-plugin/.claude-plugin/plugin.json`; custom marketplace metadata stays outside the plugin manifest. |
| Claude Code marketplace manifest | Compatible | No blocker | `.claude-plugin/marketplace.json` keeps Claude-compatible display fields only. Do not add repository-local fields such as `trust-level`, `risk-level`, `deprecated`, or `last-updated` here. |
| Repository-local marketplace metadata | Compatible | No blocker | `.claude-plugin/registry.source.json` owns trust, risk, deprecation, and last-updated fields; `.claude-plugin/marketplace.metadata.json` is generated from it. Version is `2.0.0` and `last-updated` is `2026-05-06` for this release candidate. |
| Claude Code commands | Compatible | No blocker | The 20 command files remain present. Compatibility shortcuts such as `/review-lite`, `/review-only`, and `/review-strict` remain available. |
| Claude Code skills | Compatible | No blocker | Commands and `nova-*` skills remain one-to-one. Skill frontmatter follows the Agent Skills contract. |
| Claude Code active agents | Breaking | Major required | The active set is now the 6 core agents. Former specialist roles are legacy or mapped through core agents plus capability packs. |
| Capability packs | Additive | Minor-level addition, covered by major | The 8 documentation packs add routing capability without requiring external plugins. |
| Codex review/fix/verify loop | Compatible with prerequisites | No blocker | Codex commands remain available. Local use requires Codex CLI plus Bash for the distributed scripts. |
| Codex runtime artifacts | Compatible | No blocker | `.codex/` remains runtime-only and must not be committed or treated as release source. |
| Validation scripts | Compatible for maintainers | No blocker | `validate-all`, docs validation, pack validation, and Claude compatibility checks expand release gates without changing plugin install shape. |
| Version metadata | Prepared | Release candidate action | `plugin.json`, generated marketplace files, README badges, command reference versions, and changelog release section are synchronized to `2.0.0` / `2026-05-06`. |

## Release Notes Guidance

This release candidate follows these release note boundaries:

- `CHANGELOG.md` has a `2.0.0` section dated `2026-05-06`.
- `CHANGELOG.md` calls out the breaking active-agent change prominently.
- Command and skill compatibility notes are separate from the active-agent
  breaking note so users can distinguish unchanged slash commands from changed
  routing internals.

## Validation

Required for release prep:

- `node scripts/generate-registry.mjs --write`
- `node scripts/validate-all.mjs`
- `git diff --check`
- `claude plugin validate .` when Claude CLI is installed

Bash hook syntax checks only count as locally run when Bash is available.

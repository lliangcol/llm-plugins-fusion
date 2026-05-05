# vNext Release Decision

Status: proposed
Date: 2026-05-05

## Decision

vNext should be released as a major version, with target version `2.0.0`.

This task does not bump versions. The current version fields remain unchanged:

- `nova-plugin/.claude-plugin/plugin.json`: `1.0.9`
- `.claude-plugin/marketplace.json`: `1.0.9`
- `.claude-plugin/marketplace.metadata.json`: `1.0.9`

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
| Repository-local marketplace metadata | Compatible | No blocker | `.claude-plugin/registry.source.json` owns trust, risk, deprecation, and last-updated fields; `.claude-plugin/marketplace.metadata.json` is generated from it. Version and date stay unchanged until the actual release bump. |
| Claude Code commands | Compatible | No blocker | The 20 command files remain present. Compatibility shortcuts such as `/review-lite`, `/review-only`, and `/review-strict` remain available. |
| Claude Code skills | Compatible | No blocker | Commands and `nova-*` skills remain one-to-one. Skill frontmatter follows the Agent Skills contract. |
| Claude Code active agents | Breaking | Major required | The active set is now the 6 core agents. Former specialist roles are legacy or mapped through core agents plus capability packs. |
| Capability packs | Additive | Minor-level addition, covered by major | The 8 documentation packs add routing capability without requiring external plugins. |
| Codex review/fix/verify loop | Compatible with prerequisites | No blocker | Codex commands remain available. Local use requires Codex CLI plus Bash for the distributed scripts. |
| Codex runtime artifacts | Compatible | No blocker | `.codex/` remains runtime-only and must not be committed or treated as release source. |
| Validation scripts | Compatible for maintainers | No blocker | `validate-all`, docs validation, pack validation, and Claude compatibility checks expand release gates without changing plugin install shape. |
| Version metadata | Deferred | Explicit non-action | Do not update `plugin.json`, `marketplace.json`, `marketplace.metadata.json`, README badges, or changelog release sections in this task. |

## Release Notes Guidance

When the actual vNext release is prepared:

- Bump to `2.0.0` in the plugin metadata, then regenerate the marketplace entry
  and marketplace metadata from the registry source.
- Set `last-updated` to the release date in
  `.claude-plugin/registry.source.json`.
- Move the relevant Unreleased entries into a `2.0.0` changelog section.
- Call out the breaking active-agent change prominently.
- Keep command/skill compatibility notes separate from agent compatibility
  notes so users can distinguish unchanged slash commands from changed routing
  internals.

## Validation

Required for this artifact:

- `node scripts/validate-docs.mjs`
- Codex CLI `/review` with no P1 or P2 findings

The version files listed in the Decision section must remain unchanged for this
task.

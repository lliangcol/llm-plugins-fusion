# Public API And Compatibility Surface

Status: active
Date: 2026-06-24

This repository is a workflow framework, so the public API is the set of stable
commands, plugin identifiers, generated files, validation CLIs, and documented
contracts that users and maintainers can reasonably depend on.

## Non-API Boundaries

The public API is intentionally narrow:

- `nova-plugin` is the only production plugin; registry fixtures and generated
  multi-entry examples are not stable production plugin directories.
- Marketplace metadata and the generated catalog are install and distribution
  artifacts, not a hosted public portal, paid marketplace, or frontend
  application.
- Capability packs are documentation contracts; they do not create runtime
  dynamic pack or plugin loading.
- Consumer-specific profile content, endpoints, credentials, repository
  addresses, local paths, runtime flags, business rules, and private
  knowledge-base content are not part of the public API.

## Stable Install And Plugin Identifiers

```text
/plugin marketplace add lliangcol/llm-plugins-fusion@v3.2.0
/plugin install nova-plugin@llm-plugins-fusion
```

The plugin identity is owned by `nova-plugin/.claude-plugin/plugin.json` and
the marketplace identity is owned by `.claude-plugin/registry.source.json`.

## Stable Command IDs

```text
route
senior-explore
explore
explore-lite
explore-review
plan-lite
plan-review
produce-plan
backend-plan
review
review-lite
review-only
review-strict
codex-review-only
codex-verify-only
implement-plan
implement-standard
implement-lite
codex-review-fix
finalize-work
finalize-lite
```

Each command must keep the one-to-one skill mapping:

```text
nova-plugin/commands/<id>.md
nova-plugin/skills/nova-<id>/SKILL.md
```

## Stable Validation Entrypoints

```bash
node scripts/validate-all.mjs
npm run validate
npm run validate:maintainer
node scripts/generate-registry.mjs
node scripts/generate-registry.mjs --write
node scripts/validate-plugin-install.mjs --dry-run
```

The mutation install smoke path is intentionally not a default local API:

```bash
node scripts/validate-plugin-install.mjs --accept-user-scope-mutation
```

Run it only in CI or an isolated test-user environment.

## Generated File Contract

Do not hand-edit generated marketplace outputs:

```text
.claude-plugin/marketplace.json
.claude-plugin/marketplace.metadata.json
docs/marketplace/catalog.md
```

Update `.claude-plugin/registry.source.json` or
`nova-plugin/.claude-plugin/plugin.json`, then run:

```bash
node scripts/generate-registry.mjs --write
```

## Breaking Change Triggers

Treat these as SemVer-significant:

- Removing or renaming a command.
- Removing or renaming a `nova-<id>` skill.
- Changing plugin or marketplace identity.
- Changing generated marketplace field semantics.
- Making a previously read-only command write project files.
- Changing validation CLI success or failure semantics in a way that breaks
  existing release workflows.

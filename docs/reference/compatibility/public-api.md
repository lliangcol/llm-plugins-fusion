<!-- migrated-from: docs/compatibility/public-api.md -->
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
/plugin marketplace add lliangcol/llm-plugins-fusion@v4.0.0
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

The six skills are the canonical behavior API. Commands are generated wrappers
and compatibility aliases; their presets are part of the 4.x migration API:

```text
workflow-specs/workflows.json
  -> nova-plugin/skills/nova-<canonical-surface>/SKILL.md
  -> nova-plugin/commands/<id>.md
```

The 15 compatibility aliases are evidence-gated rather than scheduled for
date-based removal. Their source policy is
`workflow-specs/nova.product.json`; removal requires real benchmark evidence,
a plugin-major release, a governed release decision, and migration
documentation.

## Generic Assistant Manifest

`adapters/generic-agent-skills/manifest.json` is a generated public inventory
validated by `schemas/assistant-manifest.schema.json`. It binds each workflow
to its canonical skill, canonical-skill replacement for compatibility aliases, owner agents,
recommended packs, typed inputs, effects, runtime requirements, permission
policy, and output contract. Product metadata and the alias-removal gates are
included so consumers do not need to reconstruct them from prose.

`negotiateWorkflowSupport()` from `@llm-plugins-fusion/conformance` provides
static, fail-closed capability negotiation. It reports `supported`,
`approval-required`, or `unsupported` from the compiled workflow, declared
adapter enforcement, available host capabilities, explicit approvals, and an
optional host-owned enforcement declaration. Missing capability state and
attempts to weaken workflow authorization fail closed. Malformed negotiation
inputs, unknown effects, and adapters that explicitly declare unsupported
enforcement also report `unsupported`. A static result is not evidence of live
assistant invocation or enforcement.

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

## Preview Filesystem API Safety

`@llm-plugins-fusion/spec.loadSpecBundle()` and
`@llm-plugins-fusion/compiler.compileDirectory()` validate schema and semantic
invariants by default using a caller-injected schema engine. Unchecked loading
is never neutrally named: use `loadSpecBundleUnchecked()` or
`compileDirectoryUnchecked()` only after an equivalent validation boundary.
The older `compileValidatedDirectory()` alias remains for 4.x compatibility,
is deprecated, and will be removed in 5.0.0. Stable `SPEC_*` errors and `llmf`
exit codes are unchanged.

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
- Reintroducing a neutrally named unchecked filesystem compiler or loader.
- Removing a retained compatibility alias before all product policy gates are
  satisfied.

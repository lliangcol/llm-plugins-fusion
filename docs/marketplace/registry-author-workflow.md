# Registry Author Workflow

Status: active
Date: 2026-05-11

This workflow is for adding or maintaining marketplace entries without changing
the current `nova-plugin/` installation path. It keeps generated marketplace
files derived from source files and gives reviewers concrete evidence for each
entry.

## Source Files

| Source | Owner | Purpose |
| --- | --- | --- |
| `.claude-plugin/registry.source.json` | Registry maintainer | Marketplace category, tags, maintainer, trust/risk status, compatibility evidence, and review policy links |
| `<plugin>/.claude-plugin/plugin.json` | Plugin maintainer | Plugin name, version, author, license, homepage, repository, keywords, and description |
| `.claude-plugin/marketplace.json` | Generated | Claude-compatible marketplace manifest |
| `.claude-plugin/marketplace.metadata.json` | Generated | Repository-local trust, risk, maintainer, compatibility, and review metadata |
| `docs/marketplace/catalog.md` | Generated | Human-readable catalog artifact |

Do not add repository-local fields such as `trust-level`, `risk-level`,
`deprecated`, `last-updated`, `maintainer`, `compatibility`, or `review` to the
Claude-compatible marketplace manifest.

## Add Or Update A Plugin Entry

1. Create or update the plugin manifest at
   `<plugin>/.claude-plugin/plugin.json`.
2. Add or update the matching entry in `.claude-plugin/registry.source.json`.
3. Fill every repository-local metadata field:
   `trust-level`, `risk-level`, `deprecated`, `last-updated`, `maintainer`,
   `compatibility`, and `review`.
4. Regenerate outputs:

```bash
node scripts/generate-registry.mjs --write
```

5. Validate the registry, generated outputs, and docs:

```bash
node scripts/generate-registry.mjs
node scripts/validate-schemas.mjs
node scripts/validate-registry-fixtures.mjs
node scripts/validate-claude-compat.mjs
node scripts/scan-distribution-risk.mjs
node scripts/validate-docs.mjs
```

For broad changes, run the full suite:

```bash
node scripts/validate-all.mjs
git diff --check
```

## Scaffold Workflow

`scripts/scaffold.mjs` scaffolds a command, matching skill, and three command
docs. It is for command/skill additions inside `nova-plugin`; it does not add a
new marketplace plugin entry.

Dry-run first:

```bash
node scripts/scaffold.mjs command /foo --stage plan --description "Create a practical foo execution plan." --dry-run
```

Common profiles:

| Profile | Use | Tools | Risk |
| --- | --- | --- | --- |
| `read` | Repository inspection or planning without file writes | `Read Glob Grep LS` | `none` |
| `artifact` | Explicit artifact writing without project-code edits | `Read Glob Grep LS Write Edit` | `low` |
| `implementation` | Bounded project-code edits and validation | `Read Glob Grep LS Write Edit MultiEdit Bash` | `medium` |

Examples:

```bash
node scripts/scaffold.mjs command /foo --stage plan --description "Create a practical foo execution plan." --dry-run
node scripts/scaffold.mjs command /foo-artifact --stage review --profile artifact --description "Write a bounded foo review artifact."
node scripts/scaffold.mjs command /foo-fix --stage implement --profile implementation --description "Implement a bounded foo fix with validation."
```

Codex command docs are centralized under `nova-plugin/docs/commands/codex/`.
Use `--docs-dir codex` or `--codex` when scaffolding a new Codex command:

```bash
node scripts/scaffold.mjs command /codex-audit --stage review --profile artifact --docs-dir codex --description "Write a bounded Codex audit artifact." --dry-run
```

After scaffolding a command, update user-facing indexes and run:

```bash
node scripts/lint-frontmatter.mjs
node scripts/validate-docs.mjs
```

Release-ready command additions also require `README.md`, `CHANGELOG.md`,
version metadata, and generated marketplace files when the plugin version
changes.

## Review Flow

Every marketplace PR should provide:

- The maintainer owner for each changed plugin entry.
- Metadata rationale for trust, risk, deprecation, and freshness fields.
- Compatibility evidence links for commands, skills, docs, validation, and
  prerequisites.
- Security review notes when hooks, scripts, dependency behavior, credentials,
  network access, or write-capable commands change.
- The exact validation commands and outputs run locally.

Use the repository PR template at
[`.github/pull_request_template.md`](../../.github/pull_request_template.md).

# Agent Development Stack

`nova-plugin` is organized as a five-layer agent development stack. The stack is
an architecture and maintenance model for the current workflow plugin. It does
not introduce a new runtime platform, a mature multi-plugin ecosystem, or a
public portal.

```text
Rules and memory
  -> skill behavior contracts
  -> deterministic guardrails
  -> core-agent delegation
  -> marketplace distribution
```

## Layer Map

| Layer | Current files | Responsibility |
| --- | --- | --- |
| Memory | [AGENTS.md](../../../AGENTS.md), [CLAUDE.md](../../../CLAUDE.md), [docs/consumers/](../../../docs/consumers/) | Repository rules, public workflow guidance, and private consumer profile boundaries |
| Skills | [nova-plugin/skills/](../../skills/), [nova-plugin/skills/_shared/](../../skills/_shared/) | Command behavior, parameter resolution, safety boundaries, outputs, and reusable policy |
| Guardrails | [nova-plugin/hooks/](../../hooks/), [scripts/](../../../scripts/) | Deterministic checks, audit hooks, schema validation, docs validation, and release evidence |
| Delegation | [nova-plugin/agents/](../../agents/), [nova-plugin/packs/](../../packs/), [docs/agents/](../../../docs/agents/) | Six core agents, documentation-only capability packs, and enhanced/fallback routing |
| Distribution | [.claude-plugin/](../../../.claude-plugin/), [nova-plugin/.claude-plugin/plugin.json](../../.claude-plugin/plugin.json), [docs/marketplace/](../../../docs/marketplace/) | Claude Code marketplace metadata, generated catalog output, and installable plugin packaging |

## Layer Responsibilities

### Memory

The memory layer defines what the repository is, how agents should work inside
it, and where private project facts belong.

- `AGENTS.md` and `CLAUDE.md` are repository guidance for coding agents.
- `docs/consumers/` defines public-safe consumer profile contracts and
  templates.
- Real consumer profiles must stay in the consumer project's own `AGENTS.md`,
  `CLAUDE.md`, `.claude/`, or private docs.

Do not move private endpoints, credentials, customer names, or closed-source
project details into this public repository.

### Skills

The skills layer is the behavior source of truth for command execution.

- `nova-plugin/commands/*.md` keeps stable slash command entry points.
- `nova-plugin/skills/nova-*/SKILL.md` owns inputs, parameter resolution,
  safety preflight, outputs, workflow, failure modes, and examples.
- `nova-plugin/skills/_shared/` keeps reusable policy for parameters, safety,
  artifacts, output contracts, and agent routing.

Commands and skills must remain one-to-one:

```text
nova-plugin/commands/<id>.md
nova-plugin/skills/nova-<id>/SKILL.md
```

### Guardrails

The guardrail layer is deterministic. It should not depend on model judgment.

- `nova-plugin/hooks/hooks.json` wires Claude Code tool-use hooks.
- `nova-plugin/hooks/scripts/` contains pre-write and post-tool scripts.
- `scripts/validate-*.mjs` and related shell checks catch schema drift,
  frontmatter drift, docs drift, hook issues, distribution risk, and runtime
  smoke failures.

Guardrails should block or report objective failures. Use docs and skills for
judgment-heavy guidance.

### Delegation

The delegation layer keeps broad work routable without reintroducing a large
active specialist-agent surface.

- `nova-plugin/agents/` contains the fixed six core active agents:
  `architect`, `builder`, `orchestrator`, `publisher`, `reviewer`, and
  `verifier`.
- `nova-plugin/packs/` contains the eight documentation-only capability packs:
  `java`, `security`, `dependency`, `docs`, `release`, `marketplace`,
  `frontend`, and `mcp`.
- Installed plugins, MCP tools, scanners, or language servers are optional
  enhanced mode. Every route must still work in fallback mode using repository
  files, scripts, and documented checklists.

Do not describe packs as runtime dynamic loading until a later design explicitly
adds that capability.

### Distribution

The distribution layer packages the current `nova-plugin` workflow for Claude
Code marketplace installation.

- `nova-plugin/.claude-plugin/plugin.json` is the plugin metadata and version
  source of truth.
- `.claude-plugin/registry.source.json` is the human-maintained registry source.
- `.claude-plugin/marketplace.json`, `.claude-plugin/marketplace.metadata.json`,
  and `docs/marketplace/catalog.md` are generated outputs.

Marketplace metadata is the installation and distribution mechanism. It should
not be described as proof that the repository is already a mature multi-plugin
ecosystem.

## Maintenance Gates

Run the checks that match the layer changed. Use `node scripts/validate-all.mjs`
for broad workflow changes, release preparation, or changes that cross several
layers.

| Layer changed | Common files | Focused checks |
| --- | --- | --- |
| Memory and docs | `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs/**`, `nova-plugin/docs/**` | `node scripts/validate-docs.mjs` |
| Skills and commands | `nova-plugin/commands/**`, `nova-plugin/skills/**` | `node scripts/lint-frontmatter.mjs` |
| Guardrails | `nova-plugin/hooks/**`, `scripts/validate-*.mjs`, distributed Bash scripts | `node scripts/validate-hooks.mjs`, `bash -n nova-plugin/hooks/scripts/pre-write-check.sh`, `bash -n nova-plugin/hooks/scripts/post-audit-log.sh`, plus the changed script's own validation |
| Delegation | `nova-plugin/agents/**`, `nova-plugin/packs/**`, `docs/agents/**` | `bash scripts/verify-agents.sh` or `.\scripts\verify-agents.ps1`, `node scripts/validate-packs.mjs` |
| Distribution | `.claude-plugin/registry.source.json`, `nova-plugin/.claude-plugin/plugin.json`, generated marketplace outputs | `node scripts/generate-registry.mjs --write`, `node scripts/validate-schemas.mjs`, `node scripts/validate-registry-fixtures.mjs`, `node scripts/validate-claude-compat.mjs` |

On Windows without Bash, local Bash-dependent checks may be skipped by
`validate-all`. Do not report hook syntax or runtime smoke checks as locally
passed unless Bash actually ran them.

## Related Documents

- [Skill-first design](dual-track-design.md)
- [Hooks design](hooks-design.md)
- [Core agent routing](../../../docs/agents/ROUTING.md)
- [Plugin-aware routing](../../../docs/agents/PLUGIN_AWARE_ROUTING.md)
- [Capability packs](../../packs/README.md)
- [Marketplace catalog](../../../docs/marketplace/catalog.md)

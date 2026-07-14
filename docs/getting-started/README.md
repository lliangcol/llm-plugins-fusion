<!-- migrated-from: docs/start-here.md -->
# Start Here

Status: active
Date: 2026-07-13

Use this page to choose the shortest trustworthy path through the repository.
The current product is one public `nova-plugin` delivery plus assistant
adapters and an internal framework kernel; it is not a public multi-plugin
portal.

## Choose Your Path

| You want to | Start with | Successful first result |
| --- | --- | --- |
| Understand the workflow without credentials | `npm run demo:route` and `npm run demo:review` | Deterministic public-safe route and review output. |
| Install the stable Claude Code plugin | [getting-started.md](first-workflow.md) | `nova-plugin` installed from exact tag `v4.0.0`, then `/nova-plugin:route` responds. |
| Use the contracts from another assistant | [consumers/README.md](../guides/assistants/README.md) | A consumer-owned profile that does not assume Claude slash-command behavior. |
| Evaluate compatibility evidence | [compatibility/README.md](../reference/compatibility/README.md) | Declared support, known-good lanes, current evidence, and historical evidence are distinguished. |
| Make a first contribution | [CONTRIBUTING.md](../../CONTRIBUTING.md#第一次贡献路径) | A small public-safe change with its focused validation evidence. |
| Maintain or release the repository | [maintainers/quickstart.md](../operations/maintainers/README.md) and [maintainers/release-runbook.md](../operations/releases/runbook.md) | The relevant focused checks and release gates are identified before mutation. |
| Find a maintenance command | [maintainers/task-catalog.md](../operations/maintainers/validation.md) | The owning script, npm shortcut, and CI job are visible from one generated catalog. |

## No-Credential Preview

From a Node.js 22+ checkout:

```bash
npm ci --ignore-scripts
npm run demo:route
npm run demo:review
npm run llmf -- inspect --root fixtures/products/minimal-plugin
```

These commands do not call an assistant or prove model quality. They expose the
deterministic workflow, compiler, and conformance contracts.

## Stable Install

Use the exact stable tag, not moving `main`:

```text
/plugin marketplace add lliangcol/llm-plugins-fusion@v4.0.0
/plugin install nova-plugin@llm-plugins-fusion
/nova-plugin:route Choose the minimum safe workflow for this task and name the validation evidence.
```

The active Write/Edit guard requires Node.js 22+ and Bash 3.2+. Codex loop
commands also require a local Codex CLI. If a prerequisite is absent, record
the affected check as skipped or unavailable instead of treating it as passed.

## Trust Boundary

- `governance/release-channels.json` owns the stable tag and commit.
- `governance/assistant-support.json` owns known-good and latest-canary lanes.
- `governance/compatibility-evidence.generated.json` owns the current evidence-derived claims.
- `node scripts/validate-all.mjs` is the default repository-wide gate.
- Public examples must not include consumer endpoints, credentials, private repository addresses, business rules, or private knowledge-base content.

For deeper navigation, continue to the [repository documentation index](../README.md).

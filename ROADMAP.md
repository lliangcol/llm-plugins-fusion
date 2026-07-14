# LLM Plugins Fusion Roadmap

<!-- generated:project-state:start -->
## Current Machine-Derived Project Facts

Do not edit this block by hand. It is synchronized by
`node scripts/sync-doc-facts.mjs --write` from repository domain sources and
`governance/product-lanes.json`.

- Plugin: `nova-plugin@4.0.0`; production plugins: 1; public path: `nova-plugin/`
- Runtime: Node.js `>=22`; distributed Bash helpers: `3.2+`
- Inventory: 21 commands, 6 skills, 6 active agents, 8 capability packs
- Workflow contract: schema v5, namespace `nova-plugin`, 21 workflows
- Evaluation datasets: `live-paired` has 168 cases and 1008 planned paired invocations; `real-task-benchmark` has 24 tasks and 432 planned invocations
- Package scripts: `check` is present; `build` is absent
- Active product lanes: `workflow-framework`, `single-plugin-delivery`, `release-candidate-promotion`, `live-assistant-evaluation`, `generic-framework-kernel`
- Planned product lanes: None
- Deferred product lanes: `production-multi-plugin-layout`, `public-portal`, `runtime-dynamic-loading`, `broad-domain-command-expansion`
- Release model: `candidate-and-promotion`
- Active PreToolUse launcher: `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh`, `bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-bash-check.sh`
- Active PostToolUse launcher: `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-write-verify.mjs`, `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/post-audit-log.mjs`
<!-- generated:project-state:end -->

This roadmap records product sequencing. Machine facts are injected from the
generated project state; product decisions are owned by
`governance/product-lanes.json`. Version numbers identify released software and
must not be reused as names for unrelated future product lanes.

## Current Direction

The current product is a single-production-plugin workflow framework centered
on `nova-plugin`:

```text
Explore -> Plan -> Review -> Implement -> Finalize
```

The current stable release is `v4.0.0`. The next release train prioritizes
governance and proof hardening without expanding the public command, skill,
agent, or capability-pack surface. Current work strengthens release truth,
least-privilege enforcement, live evaluation, and continuous release evidence.

## Phase A: Harden Release Truth And Trust Controls

Status: active.

| Work package | Required outcome |
| --- | --- |
| Machine-derived project truth | Version, runtime, inventory, scripts, hook launchers, release model, and product lanes are generated from domain sources. |
| Documentation facts | Active documentation consumes generated fact blocks and validators reject stale semantics rather than requiring exact prose. |
| Candidate release | Candidate artifacts remain bound to a signed manifest before an immutable RC tag is verified. |
| Stable promotion | Stable publication continues to verify signed RC identity, original attestations, required evidence, and deterministic rebuild equality, then publishes only the exact RC bytes. |
| Workspace-safe hooks | Write/Edit targets are lexically and physically contained in explicit allowed roots. |

Phase A exits only after release-truth, permission, shell-policy, evaluation,
continuous-ledger, split-publish, independent-review, mutation, and fault gates
all pass on the same release train.

## Phase B: Correct Capability And Compatibility Semantics

Status: active.

| Work package | Required outcome |
| --- | --- |
| Capability contract | Runtime requirements, permission policy, and enforcement evidence are independently represented and ready for the next protocol migration. |
| Instance contract | Nova inventory counts and namespace move out of the generic workflow schema. |
| Evidence registry | Compatibility levels are derived from exact assistant versions, tags, commits, scopes, and source digests. |
| Canary policy | A pinned blocking lane and latest non-blocking lane detect assistant drift without overstating support. |

## Phase C: Demonstrate Workflow Effectiveness

Status: active.

Evaluation is separated into static contracts, adapter simulation, and live
assistant execution. Initial blocking metrics are intentionally safety-focused:

- approval false negatives: zero;
- invented command, skill, agent, or pack: zero;
- unexpected project changes: zero;
- critical output-contract validity: 100%.

Quality, cost, token, and latency gates are enabled only after a versioned
baseline exists.

## Phase D: Extract The Generic Kernel

Status: active.

Generic schemas, compiler functions, capability evaluation, evidence handling,
and test fixtures may move under `framework/`. The `nova-plugin/` public path
remains stable during the current 4.x line. Command surfaces load compiled minimal
runtime contracts only after live evaluation proves no quality or safety
regression.

## Deferred Product Lanes

The following are independent product decisions, not future version names:

- production multi-plugin layout;
- hosted public portal;
- runtime dynamic pack or plugin loading;
- broad domain-command families.

They require concrete maintenance or adoption evidence. Registry fixtures prove
generator behavior only and do not activate a production multi-plugin product.

## Activation Criteria For A Production Multi-Plugin Layout

All required conditions must be met:

1. At least two independently maintained production plugin specifications.
2. Generic schemas and compiler logic contain no nova namespace or fixed-count
   assumptions.
3. Both plugins use the same validation, evidence, and release contracts.
4. At least one implementation path is maintained outside the original
   nova-specific code path.
5. Independent ownership or release cadence creates demonstrated maintenance
   pressure that the current layout cannot handle cleanly.

## Continuous Rules

- Public content must remain free of private consumer facts and runtime data.
- Generated marketplace, project-state, workflow, adapter, and compatibility
  outputs must not be hand-edited.
- Skipped checks remain skipped unless explicit replacement evidence exists.
- A stable tag never serves as the first complete integration test of a release
  workflow.
- New dependencies require an approved dependency-budget decision, lockfile,
  license review, SBOM inclusion, update policy, and removal criteria.

## Validation

Roadmap or product-lane changes require:

```bash
npm run sync:project-state
npm run validate:project-state
npm run validate:docs
git diff --check
```

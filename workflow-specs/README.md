# Canonical Workflow Specifications

Framework schema v5 separates four explicit layers: `framework.json` owns generic
vocabulary, `nova.product.json` owns product inventory, `adapters/*.json` owns
assistant enforcement/invocation claims, and `workflows.v6.json` owns typed workflow
identity, authorization, effects, enforcement, evidence, and the exact v5
compatibility projection. `behaviors.v2.json` is the behavior-complete IR
for canonical inputs/aliases/defaults/exact values, decisions, invariants, stop
conditions, steps, deviation policy, outputs, validation, and failure output.

`nova.product.json` owns the nova-specific namespace, count, stages, primary
entries, runtime compatibility, adapters, and controlled agent/pack/tool
registries. Behavior-complete direct-execution contracts are generated
under `nova-plugin/runtime/contracts/` by `framework/compiler/`; the generic
schema/compiler do not hard-code nova or the 21-workflow inventory. The legacy
`workflows.json` and `behaviors.json` files remain the deterministic v5/v1
projection inputs during the compatibility window; run
`node scripts/migrate-v6-contracts.mjs --write` to regenerate v6/v2.

The current protocol tuple is framework `5.0.0`, workflow `6.0.0`, runtime
`4.0.0`, adapter `3.0.0`, and compatibility projection `5.0.0`. The tuple is
owned by `framework.json`, not by prose.

Run `node scripts/generate-workflow-permissions.mjs --write` after editing it.
The generator owns runtime permissions, route ownership, command adapters, and
the generated workflow catalog. `node scripts/generate-runtime-contracts.mjs --write`
owns behavior-complete runtime contracts, while
`node scripts/generate-behavior-surfaces.mjs --write` owns the authoritative
generated block in every Skill. Explanatory Skill prose must not conflict with
that block.

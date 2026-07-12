# Canonical Workflow Specifications

Schema v4 separates four explicit layers: `framework.json` owns generic
vocabulary, `nova.product.json` owns product inventory, `adapters/*.json` owns
assistant enforcement/invocation claims, and `workflows.json` owns workflow
identity plus permission profiles. `behaviors.json` is the behavior-complete IR
for canonical inputs/aliases/defaults/exact values, decisions, invariants, stop
conditions, steps, deviation policy, outputs, validation, and failure output.

`nova.product.json` owns the nova-specific namespace, count, stages, primary
entries, runtime compatibility, adapters, and controlled agent/pack/tool
registries. Behavior-complete direct-execution contracts are generated
under `nova-plugin/runtime/contracts/` by `framework/compiler/`; the generic
schema/compiler do not hard-code nova or the 21-workflow inventory.

Run `node scripts/generate-workflow-permissions.mjs --write` after editing it.
The generator owns runtime permissions, route ownership, command adapters, and
the generated workflow catalog. `node scripts/generate-runtime-contracts.mjs --write`
owns behavior-complete runtime contracts, while
`node scripts/generate-behavior-surfaces.mjs --write` owns the authoritative
generated block in every Skill. Explanatory Skill prose must not conflict with
that block.

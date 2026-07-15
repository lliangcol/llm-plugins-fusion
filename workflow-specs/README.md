# Canonical Workflow Specifications

Framework schema v5 separates four explicit layers: `framework.json` owns generic
vocabulary, `nova.product.json` owns product inventory, `adapters/*.json` owns
assistant enforcement/invocation claims, and the generated `workflows.v6.json`
owns typed workflow identity, authorization, effects, enforcement, evidence, and
the exact v5 compatibility projection. The generated `behaviors.v2.json` is the
behavior-complete IR for canonical inputs/aliases/defaults/exact values,
decisions, invariants, stop conditions, steps, deviation policy, outputs,
validation, and failure output.

`nova.product.json` owns the nova-specific namespace, count, stages, primary
entries, runtime compatibility, adapters, and controlled agent/pack/tool
registries. Behavior-complete direct-execution contracts are generated
under `nova-plugin/runtime/contracts/` by `framework/compiler/`; the generic
schema/compiler do not hard-code nova or the 21-workflow inventory. The
legacy-compatible `workflows.json` and `behaviors.json` files are the authoring
sources for workflow v5 and behavior v1 during the compatibility window. Do not
hand-edit `workflows.v6.json` or `behaviors.v2.json`; run
`node scripts/migrate-v6-contracts.mjs --write` to regenerate them.

The current protocol tuple is framework `5.0.0`, workflow `6.0.0`, runtime
`4.0.0`, adapter `3.0.0`, and compatibility projection `5.0.0`. The tuple is
owned by `framework.json`, not by prose.

After editing an authoring source, regenerate v6/v2 first, then run the affected
projection generators:

```bash
node scripts/migrate-v6-contracts.mjs --write
node scripts/generate-workflow-permissions.mjs --write
node scripts/generate-runtime-contracts.mjs --write
node scripts/generate-behavior-surfaces.mjs --write
node scripts/generate-adapters.mjs --write
node scripts/generate-command-docs.mjs --write
```

These generators own runtime permissions, route ownership, behavior-complete
runtime contracts, adapter projections, all command wrappers, command-doc
contract blocks, managed Skill frontmatter, and the authoritative generated
behavior block in every Skill. Maintainers may edit explanatory Skill prose
outside generated markers, but it must not conflict with the generated block.

# Canonical Workflow Specifications

Schema v3 separates runtime requirements, permission policy, and assistant
enforcement. `workflows.json` is the machine-readable source for workflow identity,
stage, ownership, capability packs, required inputs, output contracts, risk,
invocation policy, compatibility aliases, and permission profiles.

`nova.product.json` owns the nova-specific namespace, count, and controlled
agent/pack/tool registries. Concise direct-execution contracts are generated
under `nova-plugin/runtime/contracts/` by `framework/compiler/`; the generic
schema/compiler do not hard-code nova or the 21-workflow inventory.

Run `node scripts/generate-workflow-permissions.mjs --write` after editing it.
The generator owns runtime permissions, route ownership, command adapters, and
the generated workflow catalog. `node scripts/generate-runtime-contracts.mjs --write`
owns concise direct-execution contracts. Skill prose remains the
compatibility and maintainer reference until aliases are retired.

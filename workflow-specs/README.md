# Canonical Workflow Specifications

`workflows.json` is the single machine-readable source for workflow identity,
stage, ownership, capability packs, required inputs, output contracts, risk,
invocation policy, compatibility aliases, and permission profiles.

Run `node scripts/generate-workflow-permissions.mjs --write` after editing it.
The generator owns runtime permissions, route ownership, command adapters, and
the generated workflow catalog. Skill prose remains the referenced behavioral
contract until the evidence-gated v3 single-surface migration removes aliases.

# Generic Agent Skills Adapter

`manifest.json` is a generated, schema-validated inventory of canonical
workflow metadata, contract paths, product ownership, and the retained 4.x
compatibility-alias policy. Do not edit it by hand; update the workflow and
product specifications, then run `node scripts/generate-adapters.mjs --write`.

This is an L1 parseability contract. Consumers can call
`negotiateWorkflowSupport()` from `@llm-plugins-fusion/conformance` to combine
the declared adapter enforcement, host capabilities, explicit approvals, and
an optional host-owned enforcement declaration into one of `supported`,
`approval-required`, or `unsupported`. Missing capability state is unsupported,
malformed contracts and unknown effects are unsupported, and authorization
declared by the workflow cannot be weakened by the host.
That static result does not prove live invocation or enforcement. Consumers
must supply their own adapter and current conformance evidence before claiming
L2 or L3.

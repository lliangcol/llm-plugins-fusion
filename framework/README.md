# Generic Workflow Kernel

Status: active, non-breaking 3.x extraction

`framework/core/` owns assistant-neutral input, capability, output, and evidence
semantics. `framework/compiler/` compiles the canonical workflow spec into
minimal runtime contracts. The stable public plugin path remains
`nova-plugin/`; this extraction does not claim that a production multi-plugin
layout exists.

The generic kernel must not contain a `nova-plugin` namespace constant, a
21-workflow count, or a fixed agent/pack registry. Those product-instance facts
remain in `workflow-specs/nova.product.json`. A future `plugins/` layout still
requires a second independently maintained plugin spec and release evidence.

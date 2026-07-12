# Generic Workflow Kernel

Status: active, non-breaking 3.x extraction

`framework/core/` owns assistant-neutral input, capability, output, and evidence
semantics. `framework/compiler/` compiles the v4 framework/product/adapter model
plus behavior IR into behavior-complete runtime contracts. The stable public plugin path remains
`nova-plugin/`; this extraction does not claim that a production multi-plugin
layout exists.

The generic kernel must not contain a `nova-plugin` namespace constant, a
21-workflow count, or a fixed agent/pack registry. Those product-instance facts
remain in `workflow-specs/nova.product.json`. The three-workflow
`fixtures/products/minimal-plugin/` fixture proves the framework, product,
adapter, behavior, deterministic artifact, and release-evidence chain accepts a
different namespace, three different stages, agents, paths, and mock assistant. A
future production `plugins/` layout still requires an independently maintained
second product and release evidence; this fixture does not claim that product exists.

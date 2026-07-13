# Build a Second Product

Status: preview

Use `fixtures/products/minimal-plugin/` as the public-safe reference. It has a
different namespace, three different stages, a mock adapter, and no Nova,
Claude, Codex, or fixed 21-workflow constants in compiled runtime output.

1. Define `framework.json`, `product.json`, `workflows.json`, `behaviors.json`,
   and every adapter referenced by `product.json`.
2. Run `npm run llmf -- validate --root <product-root>`.
3. Preview migration with `npm run llmf -- migrate --root <product-root>`;
   add `--write` only when `workflows.v6.json` and `behaviors.v2.json` should be
   created.
4. Run `npm run llmf -- test --root <product-root>`.
5. Build with `npm run llmf -- build --root <product-root> --out dist/bundle.json`.
6. Run `npm run llmf -- eval --root <product-root>` for deterministic static
   evidence. It does not invoke an assistant or establish live compatibility.

Adapters must declare unique IDs, enforcement, invocation, supported evidence
levels, the workflow/runtime/adapter protocol versions, and how they enforce
inputs, approvals, outputs, effects, and fallback. Assistant compatibility
levels remain derived from digest-bound evidence, not from the declaration.

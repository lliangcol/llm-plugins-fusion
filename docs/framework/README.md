# Framework and Compiler

Status: preview

The primary productization surface is the assistant-neutral specification,
compiler, conformance layer, and `llmf` preview CLI. `nova-plugin` remains the
only production plugin deliverable and marketplace installation unit; this
framework surface does not imply a mature multi-plugin ecosystem or portal.

## Evidence

- `workflow-specs/framework.json` owns the protocol tuple.
- `workflow-specs/workflows.v6.json` and `behaviors.v2.json` own typed workflow
  and restricted decision contracts.
- `framework/compiler/` compiles both Nova and the differently named
  three-workflow fixture without product constants.
- Generic product compilation retains the product-owned
  `runtimeCompatibility` object rather than projecting a Nova- or
  assistant-specific version field. The non-Nova fixture validates the whole
  compiled bundle for product-name and assistant-name leakage.
- `packages/spec/`, `packages/compiler/`, `packages/conformance/`, and
  `packages/cli/` are private npm workspaces that provide the preview SDK and
  `llmf` commands. Cross-package imports use their explicit
  `@llm-plugins-fusion/*` package contracts; the workspaces are not public npm
  packages and do not change the single-plugin release boundary.
- `@llm-plugins-fusion/spec` exposes `loadSpecBundle()` and the compatibility
  alias `validateAndLoadSpecBundle()` as validated filesystem boundaries with stable
  layout, schema, and invariant error codes. Callers inject their schema
  validator, so the private package stays independent of a specific engine.
  All `llmf` commands that read a product bundle use this validated boundary;
  the CLI supplies the repository's standard Ajv validator. Bundle layout and
  adapter paths must be relative regular files contained below their declared
  roots, with symbolic-link traversal rejected.
- `@llm-plugins-fusion/compiler` exposes `compileDirectory()` as the validated
  default. The explicitly risky `loadSpecBundleUnchecked()` and
  `compileDirectoryUnchecked()` names are reserved for callers that separately
  prove prevalidation. `compileValidatedDirectory()` is deprecated in favor of
  `compileDirectory()` and is scheduled for removal in 5.0.0. The pure
  `compileProductBundle()` API remains filesystem-free.
- Contract v6 migration is a pure framework API exported by
  `@llm-plugins-fusion/compiler`; the CLI and repository projection script use
  that package boundary instead of importing one another.
- `@llm-plugins-fusion/conformance` exposes static workflow capability
  negotiation. It combines adapter enforcement, host capabilities, and
  explicit approvals without upgrading the adapter's evidence level.
- [prompt-surface-report.md](../generated/prompt-surface-report.md) reports
  aggregate load graphs and blocking budgets.
- [real-task-benchmark.md](../generated/real-task-benchmark.md) records the
  fixed benchmark plan and honestly unavailable external metrics.

## Preview CLI

Run `npm run llmf -- <command>`. Use `npm run llmf -- --help` for the
machine-readable command summary. Commands are `init`, `validate`, `build`,
`test`, `eval`, `doctor`, `inspect`, and `migrate`. Output is one JSON object;
exit codes are stable: 0 success, 2 usage, 3 validation, 4 I/O, and 5
conformance. `init`, `build`, and `migrate --write` are the only commands that
write files.

For a second product, follow [second-product.md](second-product.md). For v5 to
v6 migration, follow [contract-v6.md](../migrations/contract-v6.md).

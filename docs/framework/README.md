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
- `packages/spec/`, `packages/compiler/`, `packages/conformance/`, and
  `packages/cli/` provide the preview SDK and `llmf` commands.
- [prompt-surface-report.md](../generated/prompt-surface-report.md) reports
  aggregate load graphs and blocking budgets.
- [real-task-benchmark.md](../generated/real-task-benchmark.md) records the
  fixed benchmark plan and honestly unavailable external metrics.

## Preview CLI

Run `npm run llmf -- <command>`. Commands are `init`, `validate`, `build`,
`test`, `eval`, `doctor`, `inspect`, and `migrate`. Output is one JSON object;
exit codes are stable: 0 success, 2 usage, 3 validation, 4 I/O, and 5
conformance. `init`, `build`, and `migrate --write` are the only commands that
write files.

For a second product, follow [second-product.md](second-product.md). For v5 to
v6 migration, follow [contract-v6.md](../migrations/contract-v6.md).

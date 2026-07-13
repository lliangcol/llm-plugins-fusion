# Contract v5 to v6 Migration

Status: preview

Contract v6 separates typed inputs, authorization profiles, effects,
enforcement requirements, evidence requirements, and response output. Behavior
v2 replaces prose decision conditions with a restricted predicate AST.

1. Keep `workflows.json` and `behaviors.json` unchanged as compatibility inputs.
2. Run `node scripts/migrate-v6-contracts.mjs --write` or use `llmf migrate` in
   a second-product directory.
3. Validate `workflows.v6.json` and `behaviors.v2.json` against their schemas.
4. Compile runtime v4 contracts and verify the v5 compatibility projection is
   byte-equivalent to the legacy source.
5. Update adapter declarations to protocol v3 and classify input, approval,
   output, effect, and fallback enforcement.
6. Regenerate runtime, permission, behavior, adapter, compatibility, and prompt
   surface outputs from their sources.

Do not infer approvals, put effects inside response output, execute arbitrary
predicate code, or upgrade compatibility claims without current evidence.

The 15 compatibility aliases remain retained. Removal requires real benchmark
evidence, a plugin-major migration, release notes, and a governed release
decision; the current benchmark is waiting for external credentials and budget.

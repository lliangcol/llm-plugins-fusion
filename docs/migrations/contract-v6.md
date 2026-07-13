# Contract v5 to v6 Migration

Status: preview

Contract v6 separates typed inputs, authorization profiles, effects,
enforcement requirements, evidence requirements, and response output. Behavior
v2 wraps prose decision conditions in a restricted, non-executable
`semantic-condition` AST leaf so migration preserves each decision exactly.
Consumers may later replace those leaves with more specific typed predicates
only when the replacement is demonstrably equivalent.

Behavior v1 sources may provide an explicit `predicate` beside the human
readable `when` description. Migration removes the source-only field and uses
the typed predicate as v2 `when`; conditions without an explicit predicate
remain bounded, non-executable `semantic-condition` leaves. Authorization and
path decisions must not rely solely on a semantic leaf.

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

Path-like and approval inputs use explicit behavior-source `type` metadata.
Every path-like input must also declare its complete `pathPolicy`; migration no
longer guesses security policy from names such as `PATH`, `FILE`, `OUTPUT`, or
`EXPORT`.

Programmatic callers should import `migrateWorkflowSpec` and
`migrateBehaviorSpec` from `@llm-plugins-fusion/compiler`. The repository CLI
and projection script are adapters over that pure package API; callers should
not import `scripts/migrate-v6-contracts.mjs` as a library.

The 15 compatibility aliases remain retained. Removal requires real benchmark
evidence, a plugin-major migration, release notes, and a governed release
decision; the current benchmark is waiting for external credentials and budget.

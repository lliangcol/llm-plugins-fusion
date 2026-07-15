# ADR 0003: Route Review Through One Canonical Surface

Status: accepted
Date: 2026-07-16

## Context

The product has one canonical review Skill, `nova-review`, but several direct
command wrappers project variants of that behavior. In the current v5 workflow
contract, `review-only` is both a compatibility alias of `review` and the target
of a route decision. The critical live dataset then requires the assistant to
return that alias as the exact answer.

This creates two competing definitions of success:

- the architecture says aliases are compatibility and discoverability entry
  points beneath a canonical Skill;
- the evaluator treats one alias as the model-selected workflow identity.

The latest bounded live attempt exposed the conflict. The Claude plugin-enabled
condition loaded the plugin but selected the canonical review hub or another
review variant instead of the alias expected by the locked label. Adding more
prompt wording would preserve the ambiguity rather than repair the contract.

## Decision

### Canonical routing identity

Automatic routing selects only the six canonical surface identifiers:

```text
explore
produce-plan
review
implement-plan
finalize-work
route
```

The canonical review invocation is `/nova-plugin:review`. A route result may
also report a direct command alias as optional compatibility information, but
the exact routing identity is the canonical surface and its structured variant
parameters.

Any workflow with `compatibilityAlias: true` is excluded from automatic exact
route targets. It remains user-invocable for the supported compatibility
window. Validators must reject a route decision that points directly to such a
workflow unless a future product decision explicitly changes the alias policy.

### Review variant parameters

The `review` behavior owns two orthogonal parameters:

| Parameter | Values | Default | Meaning |
| --- | --- | --- | --- |
| `LEVEL` | `lite`, `standard`, `strict` | `standard` | Depth, breadth, and verification intensity. |
| `MODE` | `full`, `findings-only` | `full` | Whether the result includes the full review workflow or stops after prioritized findings. |

`MODE=findings-only` is read-only and must not modify project files. It still
requires the review target and review scope inputs owned by the canonical
behavior. `LEVEL` does not imply `MODE`, and `MODE` does not change the selected
canonical surface.

The direct compatibility invocation `/nova-plugin:review-only` maps to:

```json
{
  "canonicalSurfaceId": "review",
  "variantPreset": {
    "LEVEL": "standard",
    "MODE": "findings-only"
  }
}
```

The same rule applies to other aliases: a direct invocation may supply a
documented preset, while automatic routing returns the canonical surface plus
the equivalent structured parameters.

### Compatibility behavior

- Existing 4.x alias names remain directly callable during their documented
  compatibility window.
- Alias wrappers continue to load the canonical Skill and may not copy or own
  behavior.
- Alias removal remains a separate major-version decision governed by the
  product compatibility policy and migration evidence.
- This ADR does not retrospectively reinterpret a published release or rewrite
  historical live evidence.

### Evaluation dataset versioning

JSON `schemaVersion` describes file structure; it does not identify the meaning
of expected answers. Evaluation datasets therefore gain a separate semantic
`datasetVersion`.

- The current locked route labels and critical cases become immutable semantic
  dataset v4 snapshots. Their bytes and historical verdicts are not edited to
  make the new architecture pass.
- Semantic dataset v5 uses canonical route identifiers and structured
  `variantParameters`. A findings-only review label expects `review` with
  `LEVEL=standard` and `MODE=findings-only`, not `review-only` as the exact
  route.
- Governed evaluation profiles bind an explicit dataset id, semantic version,
  cases path, and labels path. Results record all four identities.
- Baselines, reports, and compatibility claims may compare only results with
  compatible semantic versions. A migration report may show v4-to-v5 deltas,
  but it must not merge their pass rates.
- Changing an expected route, required input set, safety outcome, or scoring
  meaning requires a new semantic dataset version even when the JSON schema is
  unchanged.

## Implementation Sequence

1. Add `MODE` and the findings-only decision to the v1 behavior authoring
   source, and express alias presets in the v5 workflow authoring source.
2. Change automatic route decisions to canonical targets with structured
   parameters. Add the alias-target invariant to an existing workflow
   validator.
3. Regenerate v6/v2, runtime contracts, Skill behavior blocks, command wrappers,
   adapters, command docs, and catalogs from their sources.
4. Freeze semantic v4 datasets at versioned paths; add semantic v5 datasets and
   bind the governed profiles to their explicit identities.
5. Update static, simulation, behavior-golden, route-conformance, and live-runner
   tests before collecting new live evidence.

The implementation must keep existing CI check names and public direct alias
invocations stable. It must not edit locked v4 labels in place.

## Evidence Gates

The rollout proceeds from deterministic evidence to bounded live evidence:

1. Schema, migration drift, static contract, adapter simulation,
   behavior-golden, route-conformance, unit, integration, and full validation
   must pass.
2. Run a 12-invocation pilot: one governed review case, two assistants, two
   plugin conditions, and three attempts. Record normalized evidence only.
3. The plugin-enabled Claude slice must select canonical `review` in 3/3
   attempts, recall every required input in 3/3, and produce zero project
   writes. The pilot as a whole must have zero unauthorized writes, invented
   surfaces, or safety-gate failures.
4. Do not run the 96-invocation critical profile until the pilot passes. Do not
   run a full evaluation matrix until the critical profile passes and its
   budget is explicitly authorized.

Credentials, evaluation budget, and authenticated assistant execution are
external gates. Deterministic implementation may complete while those gates
remain pending, but compatibility claims may not be upgraded.

## Alternatives Considered

### Keep `review-only` as the exact route

Rejected. It makes one compatibility wrapper part of the model-facing
architecture and leaves canonical ownership ambiguous.

### Remove `review-only` immediately

Rejected. Direct 4.x invocations remain a compatibility contract; routing
cleanup does not authorize an early breaking removal.

### Add stronger prompt wording without changing contracts

Rejected. Prompt wording cannot resolve contradictory identity and evaluation
semantics, and it would make success dependent on assistant-specific phrasing.

### Rewrite the existing locked labels

Rejected. That would erase the definition under which historical evidence was
collected and would turn a semantic migration into an apparent regression fix.

## Consequences

- Routing, runtime contracts, adapters, and evaluation now share one identity
  model: canonical surface plus structured parameters.
- Direct aliases remain useful and backwards compatible without becoming
  model-selected workflow identities.
- Dataset migration creates additional versioned files, but it makes historical
  comparisons honest and prevents label rewrites from manufacturing a pass.
- Claude behavior remains an evidence question. This decision removes a
  contract contradiction; it does not claim the future pilot has passed.

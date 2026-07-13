# Workflow Contract SemVer Policy

Status: active

The compiler publishes an independently versioned protocol tuple:

| Contract | Current | Supported consumer range | Major-change trigger |
| --- | --- | --- | --- |
| Framework vocabulary | `5.0.0` | `>=5.0.0 <6.0.0` | Changing generic capability, risk, enforcement, or version vocabulary |
| Workflow IR | `6.0.0` | `>=6.0.0 <7.0.0` | Removing or changing typed inputs, authorization, effects, evidence, or output semantics |
| Runtime contract | `4.0.0` | `>=4.0.0 <5.0.0` | Changing runtime input, effect, enforcement, evidence, or behavior interpretation |
| Adapter contract | `3.0.0` | `>=3.0.0 <4.0.0` | Changing assistant projection identity, enforcement, evidence, or fallback semantics |
| v5 compatibility projection | `5.0.0` | `>=5.0.0 <6.0.0` | Changing the exact legacy workflow projection |

Minor versions may add optional fields whose absence preserves existing
behavior. Patch versions may correct descriptions, validation messages, or
generated ordering without changing semantics. Consumers must reject an
unsupported major version rather than guessing.

The current migration keeps all 21 command names. Six skills
(`route`, `explore`, `produce-plan`, `review`, `implement-plan`, and
`finalize-work`) are canonical. The other 15 command names are deprecated
aliases that carry only a canonical surface id and variant preset. Removing an
alias requires benchmark evidence, a plugin-major migration entry, and an
explicit release decision. Current real-task benchmark metrics are unavailable
until external assistant credentials and evaluation budget exist, so all 15
aliases are retained; static prompt-size evidence alone is not a removal gate.

Contract versions are sourced from `workflow-specs/framework.json` and emitted
into generated runtime and adapter projections. Documentation is not a version
source.

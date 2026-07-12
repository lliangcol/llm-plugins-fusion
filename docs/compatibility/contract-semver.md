# Workflow Contract SemVer Policy

Status: active

The 4.0 compiler publishes three independently versioned machine contracts:

| Contract | Current | Supported consumer range | Major-change trigger |
| --- | --- | --- | --- |
| Workflow IR | `5.0.0` | `>=5.0.0 <6.0.0` | Removing or changing canonical surface, variant, permission, input, or output semantics |
| Runtime contract | `3.0.0` | `>=3.0.0 <4.0.0` | Changing route output fields, enforcement meaning, or required runtime interpretation |
| Adapter contract | `2.0.0` | `>=2.0.0 <3.0.0` | Changing assistant projection identity, evidence meaning, or compatibility-alias semantics |

Minor versions may add optional fields whose absence preserves existing
behavior. Patch versions may correct descriptions, validation messages, or
generated ordering without changing semantics. Consumers must reject an
unsupported major version rather than guessing.

The 4.x migration keeps all 21 command names for one major cycle. Six skills
(`route`, `explore`, `produce-plan`, `review`, `implement-plan`, and
`finalize-work`) are canonical. The other 15 command names are deprecated
aliases that carry only a canonical surface id and variant preset. Removing an
alias requires the next plugin major and a changelog migration entry.

Contract versions are sourced from `workflow-specs/workflows.json` and emitted
into generated runtime and adapter projections. Documentation is not a version
source.

# Engineering evidence levels

Generated from `governance/engineering-evidence.json#/evidenceLevels`.

| Level | Name | Proves | Does not prove |
| --- | --- | --- | --- |
| E0 | Static | Schemas, documentation, contracts, and generated drift | CLI installation or assistant behavior |
| E1 | Fixture | Deterministic educational rendering and fixture signals | LLM, network, or installation behavior |
| E2 | Local smoke | Local scripts, tutorials, and safe install planning paths | User-scope installation or authenticated invocation |
| E3 | Isolated install | An exact artifact installs in a disposable identity and its tree matches | Assistant workflow adherence |
| E4 | Authenticated route | An isolated read-only route invocation obeys installation, inventory, and no-write safety contracts | Full workflow quality or broad adoption |
| E5 | Live evaluation | Versioned multi-case behavior statistics for a named assistant and attempt policy | Other versions, user projects, or production outcomes |

The highest accepted source-controlled stable proof is **E3** from `governance/stable-install-proof.json`. Dynamic E3-E5 records remain in CI artifacts, candidate bundles, release control bundles unless a governed promotion process accepts a public-safe summary. Credentials, raw prompts, raw model responses, and local absolute paths are forbidden.

## Candidate validation performance evidence

Generated from `governance/engineering-evidence.json#/validationPerformance` and each profile's content-addressed sample manifest. Counts, P95 observations, derived budgets, and digests are recomputed; no `sampleCount` field is trusted. Repository records are not sufficient provenance: candidate preflight separately verifies every run attempt, job, source ref, artifact API digest, downloaded archive, and raw report against GitHub Actions.

| Profile | Manifest records | Observation window | Derived budget | Manifest digest | Aggregate digest | Offline state |
| --- | ---: | --- | --- | --- | --- | --- |
| `linux-x64-node22-github-hosted-3-fresh-process-full-uncached` | 0/20 | none | pending | `56cf83be8e46dab884f5299d5495aa14cd71f9945eae9fa53e7eca5e7537aeb3` | `47bbb975e14a8567ea1c3939d6ffe30a022437d0f8fddcac82ef1ee93fa581de` | **BLOCKED** |

The fixed derivation is nearest-rank P95 plus 25% headroom, rounded up to 1,000ms. A governed budget must remain null below 20 samples and must equal the recomputed aggregate once the threshold is met. Even 20 shape-valid records remain blocked until the online GitHub provenance check succeeds for every sample.

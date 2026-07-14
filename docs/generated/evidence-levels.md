# Engineering evidence levels

Generated from `governance/evidence-levels.json`.

| Level | Name | Proves | Does not prove |
| --- | --- | --- | --- |
| E0 | Static | Schemas, documentation, contracts, and generated drift | CLI installation or assistant behavior |
| E1 | Fixture | Deterministic educational rendering and fixture signals | LLM, network, or installation behavior |
| E2 | Local smoke | Local scripts, tutorials, and safe install planning paths | User-scope installation or authenticated invocation |
| E3 | Isolated install | An exact artifact installs in a disposable identity and its tree matches | Assistant workflow adherence |
| E4 | Authenticated route | An isolated read-only route invocation obeys installation, inventory, and no-write safety contracts | Full workflow quality or broad adoption |
| E5 | Live evaluation | Versioned multi-case behavior statistics for a named assistant and attempt policy | Other versions, user projects, or production outcomes |

The highest accepted source-controlled stable proof is **E3** from `governance/stable-install-proof.json`. Dynamic E3-E5 records remain in CI artifacts, candidate bundles, release control bundles unless a governed promotion process accepts a public-safe summary. Credentials, raw prompts, raw model responses, and local absolute paths are forbidden.

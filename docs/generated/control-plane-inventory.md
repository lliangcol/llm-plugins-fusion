# Control-plane inventory

Generated from package scripts, the runnable validation registry, GitHub workflows, governance sources, generators, and product lanes.

- Package scripts: 78
- Runnable validation tasks: 46
- GitHub workflows: 10
- Governance sources: 18
- Generators: 20

| Boundary | Path | Scope | Generated | Quality gate |
| --- | --- | --- | --- | --- |
| `plugin-archive` | `nova-plugin/` | user-runtime | no | `scripts/scan-distribution-risk.mjs` |
| `marketplace-metadata` | `.claude-plugin/` | distribution | yes | `scripts/generate-registry.mjs` |
| `maintainer-control-plane` | `scripts/, governance/, schemas/, tests/, .github/` | maintainer | no | `scripts/validate-all.mjs` |
| `generated-projections` | `docs/generated/ and governed generated JSON` | documentation | yes | `npm run validate:drift` |
| `external-evidence` | `CI artifacts and candidate/control bundles` | external | yes | `release readiness and promotion gates` |

Deferred lanes are not current capabilities: `production-multi-plugin-layout`, `public-portal`, `runtime-dynamic-loading`, `broad-domain-command-expansion`.

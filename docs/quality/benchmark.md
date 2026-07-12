# Public Workflow Quality Benchmark

Status: generated
Date: 2026-07-12

## Claim Boundary

Static results prove dataset/spec integrity, simulation proves deterministic adapter state transitions, and the checked-in bare-CLI observations cover only two public-safe route/approval prompts on the exact CLI versions and source digests shown. They do not load an adapter, prove broad model quality, establish production latency, or prove release publication.

## Deterministic Gates

| Layer | Passed | Safety result |
| --- | ---: | --- |
| Static contract | 12/12 | Invented surface rate 0 |
| Adapter simulation | 8/8 | Unsafe continuation 0 |
| Targeted critical mutants | 3/3 | Three manually selected operators; not a repository-wide mutation score |

## Bare-CLI Exact-Version Observations

| Assistant | Exact version | Contract pass | Unsafe side effects | Invented surfaces | Median ms | Min–max ms | n | Workflow digest |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| claude-code | 2.1.205 (Claude Code) | 2/2 | 0 | 0 | 12482 | 12215–12748 | 2 | a0004c565a79 |
| codex | codex-cli 0.144.0-alpha.4 | 2/2 | 0 | 0 | 45833 | 43352–48314 | 2 | a0004c565a79 |

Small samples are reported as median and range, not P95. Failed or superseded probes remain under `evals/evidence-attempts/` and never upgrade compatibility. Current claims are derived in `governance/compatibility-evidence.generated.json`.

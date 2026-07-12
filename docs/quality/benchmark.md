# Public Workflow Quality Benchmark

Status: generated
Date: 2026-07-12

## Claim Boundary

Static results prove dataset/spec integrity, simulation proves deterministic adapter state transitions, and live results cover only two public-safe route/approval probes on the exact CLI versions and source digests shown. They do not prove broad model quality, production latency, or release publication.

## Deterministic Gates

| Layer | Passed | Safety result |
| --- | ---: | --- |
| Static contract | 12/12 | Invented surface rate 0 |
| Adapter simulation | 8/8 | Unsafe continuation 0 |
| Critical mutation | 3/3 | Score 100% |

## Live Exact-Version Probes

| Assistant | Exact version | Contract pass | Unsafe side effects | Invented surfaces | P95 latency ms | Workflow digest |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| claude-code | 2.1.205 (Claude Code) | 2/2 | 0 | 0 | 12748 | a0004c565a79 |
| codex | codex-cli 0.144.0-alpha.4 | 2/2 | 0 | 0 | 48314 | a0004c565a79 |

Failed or superseded probes remain under `evals/evidence-attempts/` and never upgrade compatibility. Current claims are derived in `governance/compatibility-evidence.generated.json`.

# Evaluation profiles

Generated from `governance/evaluation-profiles.json`. Planned, executed, passed, skipped, and blocked are never interchangeable.

| Profile | Dataset | Mode | Cases | Planned | Prerequisites | Executed | Passed | Skipped | Blocked | Evidence |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| pilot | critical-live@v5 | external-live | 1 | 12 | none | 0 | 0 | 0 | 12 | external-evidence |
| critical | critical-live@v5 | external-live | 8 | 96 | pilot | 0 | 0 | 0 | 96 | external-evidence |
| pr | live-paired@v5 | plan-only | 84 | 84 | none | 0 | 0 | 0 | 0 | not-verified |
| nightly | live-paired@v5 | simulation | 84 | 84 | none | 0 | 0 | 0 | 0 | not-verified |
| release | live-paired@v5 | external-live | 168 | 2016 | pilot, critical | 0 | 0 | 0 | 2016 | external-evidence |
| manual | live-paired@v5 | external-live | 168 | 2016 | pilot, critical | 0 | 0 | 0 | 2016 | external-evidence |

The 12-invocation pilot is diagnostic only while assistant executable provenance is caller-supplied. Critical, full, and paired E5 execution remain blocked by an external governed assistant-release provenance gate even when prerequisite slices pass schema, digest, semantic, completeness, and safety inspection. The 24-task real-task benchmark remains a separate dataset with 432 planned external invocations and zero newly authorized executions in this remediation. Legacy minimal CLI observations do not raise compatibility levels.

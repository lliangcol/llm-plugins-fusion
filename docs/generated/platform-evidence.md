# Platform evidence matrix

Generated from `governance/platform-evidence.json`.

| Task | Classification | No-Bash Windows path | Evidence strength | Reason code |
| --- | --- | --- | --- | --- |
| `agents.verify` | `powershell-equivalent` | .\scripts\verify-agents.ps1 | equivalent | `CHECK_PASSED` |
| `node.validators` | `native-node` | node scripts/validate-all.mjs | authoritative | `CHECK_PASSED` |
| `hooks.syntax` | `bash-authoritative` | none | external | `BASH_CAPABILITY_UNAVAILABLE` |
| `runtime.payload` | `native-node` | node payload unit and integration tests | partial | `CHECK_PASSED` |
| `runtime.launcher` | `bash-authoritative` | none | external | `BASH_CAPABILITY_UNAVAILABLE` |
| `hooks.container` | `container-candidate` | none | external | `CONTAINER_FALLBACK_UNAVAILABLE` |

PowerShell and Node evidence never imply that Bash syntax or launcher behavior passed. Git Bash, WSL, and CI are valid only when Bash actually runs. Container fallback is not automatic; it requires an explicit flag, an approved digest-pinned image, read-only mounts, disabled networking, and fixed argv. The current policy has no approved container image, so the container path remains External evidence.

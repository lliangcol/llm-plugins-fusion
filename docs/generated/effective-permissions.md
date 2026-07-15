# Effective Permissions

Status: generated

Generated from `workflow-specs/workflows.v6.json` by `node scripts/generate-workflow-permissions.mjs --write`. `allowed-tools` are pre-approvals, not a complete whitelist.

- Known-good Claude CLI: `2.1.205`
- Expected installed Skills: 27

| Invocation | Visibility | Risk | Model invocable | Pre-approved | Disallowed | Permission prompt |
| --- | --- | --- | --- | --- | --- | --- |
| `/nova-plugin:backend-plan` | deprecated-alias | low | false | Read, Glob, Grep, Write, Edit | NotebookEdit, Bash | None |
| `/nova-plugin:codex-review-fix` | deprecated-alias | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:codex-review-only` | deprecated-alias | low | false | Read, Glob, Grep | Write, Edit, NotebookEdit | Bash |
| `/nova-plugin:codex-verify-only` | deprecated-alias | low | false | Read, Glob, Grep | Write, Edit, NotebookEdit | Bash |
| `/nova-plugin:explore` | primary | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-explore` | canonical | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:explore-lite` | deprecated-alias | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:explore-review` | deprecated-alias | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:finalize-lite` | deprecated-alias | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:finalize-work` | primary | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit | Bash |
| `/nova-plugin:nova-finalize-work` | canonical | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit | Bash |
| `/nova-plugin:implement-lite` | deprecated-alias | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:implement-plan` | primary | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:nova-implement-plan` | canonical | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:implement-standard` | deprecated-alias | medium | false | Read, Glob, Grep, Write, Edit | NotebookEdit | Bash |
| `/nova-plugin:plan-lite` | deprecated-alias | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:plan-review` | deprecated-alias | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:produce-plan` | primary | low | false | Read, Glob, Grep, Write, Edit | NotebookEdit, Bash | None |
| `/nova-plugin:nova-produce-plan` | canonical | low | false | Read, Glob, Grep, Write, Edit | NotebookEdit, Bash | None |
| `/nova-plugin:review` | primary | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-review` | canonical | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:review-lite` | deprecated-alias | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:review-only` | deprecated-alias | none | false | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:review-strict` | deprecated-alias | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:route` | primary | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:nova-route` | canonical | none | true | Read, Glob, Grep | Write, Edit, NotebookEdit, Bash | None |
| `/nova-plugin:senior-explore` | deprecated-alias | low | false | Read, Glob, Grep, Write, Edit | NotebookEdit, Bash | None |

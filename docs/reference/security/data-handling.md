<!-- migrated-from: docs/privacy/data-handling.md -->
# Data Handling And Local Audit Logs

Status: active
Date: 2026-07-09

This repository publishes generic workflow guidance, redacted examples, prompt
templates, validation scripts, and the `nova-plugin` distribution surface. It
must not contain real consumer profiles, endpoints, credentials, private
repository addresses, runtime flags, business rules, customer data, local
machine paths, or private knowledge-base content.

## Local Audit Log

`nova-plugin` includes a `PostToolUse` hook that records a local audit summary
after `Write`, `Edit`, `NotebookEdit`, and `Bash` tool use. The hook writes only to
the local plugin data or state directory. It does not write audit logs to this
repository.

Default path:

```text
${CLAUDE_PLUGIN_DATA:-${XDG_STATE_HOME:-$HOME/.local/state}/nova-plugin}/audit.log
```

The hook writes one `600`-mode atomic record under `audit-spool/`; an
independent Node compactor uses an atomic directory lock to append complete
records to `audit.log` and rotate to `audit.log.1` after 5 MB. Concurrent hook
processes therefore do not race on append/rotation. Compaction failures retain
the spool record and emit a best-effort `audit-health.log` degraded event.
Lock ownership records PID, host, start time, and process-start identity. An
expired lock is recovered only when the owner is absent or the PID now refers
to a different process; recovery also emits a degraded health event.
The hook creates the state directory with `700` permissions and the log file with
`600` permissions when the platform supports POSIX modes; the log
rotates to `audit.log.1` after 5 MB.
Existing audit-directory path components and final audit directories must be
real directories rather than caller-owned links. Audit logs, lock-owner files,
and spool records must be regular files with exactly one hard link; linked or
replaced paths fail closed before append, compaction, or record deletion.

Set this environment variable to disable local audit logging in an environment:

```bash
NOVA_AUDIT_DISABLED=1
```

## Redaction Boundary

Audit summaries use best-effort redaction for common token, bearer header, JWT,
npm token, GitHub token, Slack token, OpenAI key, and secret-assignment shapes.
Workspace paths are recorded relative to the payload project root. Paths
outside that root are represented only as a short SHA-256-derived identifier.
Untrusted tool names and summaries are normalized to one line after redaction:
control characters become spaces, repeated whitespace is collapsed, tool names
are limited to 32 characters, and summaries are limited to 200 characters.
Redaction is a guardrail, not a guarantee. Do not paste real secrets, endpoints,
private customer details, or private repository paths into public issues,
examples, prompts, or release evidence.

If the redaction helper is unavailable, the audit hook records a placeholder
summary rather than echoing command text. Treat missing runtime tooling as an
environment issue and record it as skipped or unavailable evidence; do not
broaden permissions or commit local audit logs as a workaround.

## Public Documentation Boundary

Public docs may include:

- Generic workflow guidance.
- Redacted examples and fixtures.
- Consumer profile contracts and templates.
- Prompt templates without private facts.
- Aggregate validation evidence and release check summaries.

Public docs must not include:

- Real consumer names or profile contents.
- Local machine paths, private repository URLs, or endpoints.
- Credentials, tokens, private keys, or raw authorization headers.
- Runtime flags or permission bypass advice copied from private environments.
- Customer data, business rules, or private knowledge-base content.

Use consumer-owned repositories, private workbench artifacts, or local
environment variables for private details.

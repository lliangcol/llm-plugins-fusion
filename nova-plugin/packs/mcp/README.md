# MCP Capability Pack

## Purpose

Support MCP configuration, server/client examples, and tool integration guidance.

## When to Use

Use this pack for `.mcp.json`, MCP server setup, client examples, tool permission guidance, and integration documentation.

## Related Plugins

Optional enhancement: available MCP tools or plugins in the host environment. They are not hard dependencies of `nova-plugin`.

## Inputs

- MCP config files and server/client targets.
- Tool names, permissions, and environment variables.
- Integration docs and schema constraints.
- Local validation or smoke-test commands.

## Agent Routing

- `architect`: integration boundaries and security model.
- `builder`: scoped config or example implementation.
- `reviewer`: permission, security, and maintainability review.
- `verifier`: schema checks, smoke tests, and docs validation.
- `publisher`: integration docs and handoff notes.

## Workflow

1. Identify the MCP server/client shape and trust boundary.
2. Review configs, environment assumptions, and permission exposure.
3. Make minimal config or example changes.
4. Validate syntax, docs, and any available smoke tests.

## Verification

- Check `.mcp.json` or related config syntax when present.
- Run project-specific schema or smoke tests when available.
- Verify documentation links and setup steps.
- Record missing credentials or unavailable services.

## Enhanced Mode

If MCP tools or plugins are available, use them for server discovery, schema understanding, integration testing, or tool behavior checks.

## Fallback Mode

Use `.mcp.json`, local docs, schema checks, config review, and manual reasoning about tool permissions.

## Failure Modes

- Required MCP server is not installed or running.
- Credentials or network services are unavailable.
- Tool permissions are too broad or undocumented.
- Config examples drift from supported client behavior.

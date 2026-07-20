# Plugin Lifecycle

Status: active
Date: 2026-07-19

Use this guide after the first installation to inspect, update, temporarily
disable, re-enable, or uninstall `nova-plugin`. These are consumer operations;
repository generation, validation, candidate creation, and stable promotion are
maintainer operations documented under `docs/operations/`.

## Identify The Installed State

Start with read-only inspection:

```bash
claude plugin list --json
claude plugin details nova-plugin@llm-plugins-fusion
claude plugin marketplace list
```

Record the installed scope (`user`, `project`, or `local`) and marketplace
source before changing anything. The stable consumer source is the exact tag
published in `governance/release-channels.json`; moving `main` is an unreleased
Edge source and may be ahead of the stable version.

## Refresh And Update

Refresh marketplace metadata first, then update the plugin in the same scope in
which it is installed:

```bash
claude plugin marketplace update llm-plugins-fusion
claude plugin update nova-plugin@llm-plugins-fusion --scope user
```

Replace `user` with `project` or `local` when that is the recorded installation
scope. Restart Claude Code after an update; the CLI reports that updates require
a restart before the new plugin version is applied. An update follows the
configured marketplace source, so it does not convert an Edge checkout into a
stable exact-tag installation.

## Temporarily Disable Or Re-enable

Disable the plugin when isolating plugin behavior without deleting its installed
data, then re-enable it in the same scope:

```bash
claude plugin disable nova-plugin@llm-plugins-fusion --scope user
claude plugin enable nova-plugin@llm-plugins-fusion --scope user
```

After re-enabling, start a fresh Claude Code session and verify
`/nova-plugin:route` before relying on write-capable workflows.

## Uninstall

Uninstall only from the intended scope:

```bash
claude plugin uninstall nova-plugin@llm-plugins-fusion --scope user
```

Add `--keep-data` when persistent plugin data must remain available for a later
reinstall. Dependency pruning is a separate destructive choice: `--prune`
removes no-longer-needed auto-installed dependencies and requires `--yes` in a
non-interactive shell. Do not add those flags unless their effects are intended.

## Recovery Checklist

If a command remains missing or stale:

1. Confirm the marketplace and plugin with the read-only inspection commands.
2. Confirm the scope matches the update, enable, disable, or uninstall command.
3. Refresh the marketplace, update the plugin, and restart Claude Code.
4. Run `/nova-plugin:route` with a small read-only request.
5. If the issue remains, record the CLI version, scope, marketplace source,
   plugin list/details output, and whether the source is Stable or Edge.

Do not report a moving-`main` installation as the published stable plugin, and
do not treat a successful install or update as proof that model-quality or
write-path evaluation has passed.

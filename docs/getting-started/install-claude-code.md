# Install with Claude Code

Use the marketplace metadata described in the [repository README](../../README.md). Run the diagnostic preview before any user-scope installation:

```bash
npm run doctor
node scripts/validate-plugin-install.mjs --dry-run
```

The dry run validates packaging and installation intent without changing user-scoped Claude state. A real installation is a separate, explicitly authorized action.

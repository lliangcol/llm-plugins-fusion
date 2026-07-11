# Consumer Rules

- Treat this fixture as read-only.
- Use the canonical workflow manifest at `../../../adapters/generic-agent-skills/manifest.json`.
- Do not use network access, credentials, user-scope mutation, external publishing, or Git history mutation.
- If the selected adapter cannot enforce a capability, report the limitation instead of claiming success.

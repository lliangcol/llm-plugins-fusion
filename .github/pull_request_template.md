# Pull Request Checklist

## Summary

- What changed:
- Why it changed:
- Maintainer owner:

## Marketplace Metadata

- [ ] Registry source updated when marketplace fields changed.
- [ ] Metadata rationale included for trust level, risk level, deprecation, and last-updated.
- [ ] Compatibility evidence points to commands, skills, docs, validation, and prerequisites.
- [ ] Generated marketplace, metadata, and catalog outputs were produced by `node scripts/generate-registry.mjs --write`.

## Security And Risk

- [ ] Security-sensitive behavior is described, or this PR explains why none is affected.
- [ ] Risk level matches write tools, hooks, scripts, dependencies, credentials, and network behavior.
- [ ] Private vulnerability details are not disclosed publicly.

## Validation

Paste the commands run and summarize the result:

```text
node scripts/generate-registry.mjs
node scripts/validate-all.mjs
git diff --check
```

Bash hook syntax:

```text
bash -n nova-plugin/hooks/scripts/pre-write-check.sh
bash -n nova-plugin/hooks/scripts/post-audit-log.sh
```

If a check was skipped, explain the concrete reason.

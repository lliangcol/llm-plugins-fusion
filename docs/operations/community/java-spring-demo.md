# Java/Spring workflow recording guide

Status: capture-ready; real assistant recording pending
Date: 2026-07-16

This guide produces a public-safe, reproducible Claude Code walkthrough for the
five-stage nova workflow. It uses the fictional Java/Spring scenario in
`docs/tutorials/java-backend.md`; it does not use a real consumer repository.
The deterministic README GIF is separate contract evidence and must not be
presented as this live recording.

## Capture environment

- Use a disposable public demo repository with generic package and resource
  names, or a reviewed copy of the fictional tutorial inputs.
- Install an exact release tag. If the recording uses `main`, label every
  frame as a development snapshot.
- Record the Claude Code version, plugin ref, source commit, OS, and shell in a
  private capture worksheet before recording.
- Keep credentials, local paths, repository remotes, account names,
  notifications, and unrelated terminal history outside the frame.

## Preflight

Run these in this repository and keep the sanitized result with the capture
worksheet:

```bash
npm ci --ignore-scripts
npm run doctor
npm run demo:route
npm run validate:workflow
```

A skipped or unavailable check remains visible. Preflight proves repository
contract readiness; it does not prove the later Claude session succeeded.

## Recording script

1. Install and confirm `nova-plugin` from the selected exact ref.
2. Show this fictional request:

   ```text
   Add a validated endpoint that updates a generic resource preference.
   Preserve the public response boundary and add focused tests.
   ```

3. Run the read-only route and exploration:

   ```text
   /nova-plugin:route REQUEST="Select the smallest safe workflow for this fictional Java/Spring change."
   /nova-plugin:explore INPUT="Map controller, validation, service, persistence, error, and test boundaries. Do not propose code."
   ```

4. Produce a plan in the disposable project, then review findings only:

   ```text
   /nova-plugin:produce-plan REQUEST="Plan the scoped fictional preference update and its tests." PLAN_OUTPUT_PATH="docs/plans/preference-update.md"
   /nova-plugin:review REVIEW_SCOPE="docs/plans/preference-update.md" MODE=findings-only LEVEL=standard
   ```

5. Show that implementation does not begin without exact approval. In the
   disposable project only, approve the reviewed plan, run
   `/nova-plugin:implement-plan`, execute the project-local tests, and finish
   with `/nova-plugin:finalize-work`.
6. End on changed files, actual validation, skipped checks, residual risk, and
   the exact plugin/assistant versions.

## Acceptance checklist

- Canonical `/nova-plugin:review` is used;
  `/nova-plugin:review-only` is not shown as an automatic routing target.
- `MODE=findings-only` yields findings without project writes.
- Missing required inputs and missing approval are visibly blocked.
- No unrelated project file, user-scope state, Git state, or release state is
  changed.
- Maven or Gradle output shown in the recording actually ran in the disposable
  project; unavailable checks are not restaged as passes.
- The published video includes captions or a transcript and a short evidence
  note naming the exact ref and limitations.

## Privacy and publication

Review every frame and transcript against
[data handling](../../reference/security/data-handling.md) and the
[asset capture checklist](assets.md). Publication requires a maintainer privacy
review. Do not retain raw private footage in this public repository.

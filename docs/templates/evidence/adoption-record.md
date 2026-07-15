# External adoption record template

Status: template; not adoption evidence

Use this template only after an external user has knowingly consented to a
public-safe, redacted record. Raw interview notes, identifiers, screenshots,
prompts, model responses, credentials, local paths, and consumer repository
details never belong in this repository.

## Private collection worksheet

Keep this section outside the public repository:

- Participant contact and consent timestamp:
- Consent scope and withdrawal channel:
- Raw session notes location and deletion date:
- Reviewer responsible for redaction:

Do not copy those values into the public record.

## Public-safe record

```yaml
recordId: ADOPTION-YYYY-NNN
consumerClass: generic description only
assistant: product and exact version
sourceCommit: full repository commit
sourceDigest: 64 lowercase hexadecimal characters
signals:
  - installation
  - activation
  - successful-workflow
validationEvidence: repository-relative public-safe evidence path
consentEvidence: repository-relative redacted consent-attestation path
privacyReview: passed
observedAt: YYYY-MM-DDTHH:MM:SSZ
expiresAt: YYYY-MM-DDTHH:MM:SSZ
```

## Signal checklist

- **installation**: the exact plugin artifact or ref installed successfully.
- **activation**: the expected inventory was visible to the assistant.
- **successful-workflow**: one named workflow reached its bounded outcome with
  actual validation and no unrelated writes.
- **maintenance-commitment**: a non-maintainer opened or completed a concrete
  maintenance contribution.

Record only signals supported by retained, digest-bound evidence. A fixture,
maintainer-run demo, Star, clone, or download is not an external adoption
record.

## Redaction and consent review

- The participant approved the public-safe purpose and fields.
- Consumer names, people, paths, endpoints, repository addresses, business
  rules, customer data, credentials, raw prompts, and raw responses are absent.
- The assistant version, source commit, source digest, observed time, and
  expiry time are exact.
- Validation distinguishes passed, failed, skipped, blocked, and unavailable.
- The withdrawal instruction in `governance/adoption-evidence.json` was
  provided.
- A maintainer independent of the redaction pass confirmed
  `privacyReview: passed`.

After review, project the public-safe fields into
`governance/adoption-evidence.json`. Status remains `not-demonstrated` until
at least two valid records exist; never create placeholder records to satisfy
the threshold.

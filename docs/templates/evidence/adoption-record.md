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

Project this record into the containing `governance/adoption-evidence.json`
ledger, whose current contract is `schemaVersion: 3`. The version belongs to
the ledger document, not to an individual record.

```yaml
recordId: ADOPTION-YYYY-NNN
consumerClass: generic description only
assistant: product and exact version
sourceCommit: 40 lowercase hexadecimal characters for the exact repository commit
sourceDigest: 64 lowercase hexadecimal characters
signals:
  - installation
  - activation
  - successful-workflow
validationEvidence: repository-relative public-safe JSON evidence path
validationEvidenceSha256: SHA-256 of the exact validation evidence file bytes
consentEvidence: repository-relative redacted JSON consent-attestation path
consentEvidenceSha256: SHA-256 of the exact consent evidence file bytes
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

Record only signals supported by retained, digest-bound evidence. The validation
file must satisfy `schemas/adoption-validation-evidence.schema.json`, bind the
record ID, canonical public-field digest, assistant, reachable source commit,
installed-artifact digest, observation time, and an exact passed result for
every claimed signal. A fixture,
maintainer-run demo, Star, clone, or download is not an external adoption
record.

Both evidence paths must name distinct, tracked, regular files in this public
repository. A validation or consent path may appear in only one record, and
identical bytes copied to a new path do not create another record: every
evidence digest is globally unique across both roles. The consent file must
satisfy `schemas/adoption-consent-evidence.schema.json`, bind the exact record
and validation-file digests, attest the public purpose and approved fields,
acknowledge withdrawal, and carry matching expiry and privacy-review states.
Use normalized POSIX repository-relative paths with `/`; URLs,
absolute paths, Windows drive or UNC paths, backslashes, empty components, and
`.` or `..` traversal components are invalid. Each adjacent SHA-256 value must
match the exact checked-in file bytes. Do not add a record until both reviewed
public-safe files exist.

Every `recordId`, individual evidence path, evidence digest, and
validation/consent evidence-file pair must be unique across records.
`observedAt` cannot be in the future; `expiresAt` must be later than both
`observedAt` and the consent time, and the interval from observation to
expiry cannot exceed `collectionPolicy.retentionDays`. Only records satisfying
all schema, Git-reachability, cross-binding, file, digest, uniqueness, consent,
privacy, and time checks are maintainer-attested inputs. They do not count as
independent external provenance and cannot by themselves unlock a
`demonstrated` claim.

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
`governance/adoption-evidence.json`. Status remains `not-demonstrated` even
after two locally valid records exist until a separately governed independent
external provenance verifier corroborates source, workflow result, and consent
origin. Never create placeholder or mutually self-attesting records to satisfy
the threshold.

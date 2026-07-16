import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validate, validateSchemaKeywords } from '../../scripts/validate-schemas.mjs';

test('schema validator enforces integer, minimum, date-time, and deep uniqueItems', () => {
  assert.deepEqual(validate({ type: 'integer', minimum: 0 }, 1), []);
  assert.notDeepEqual(validate({ type: 'integer' }, 1.5), []);
  assert.notDeepEqual(validate({ type: 'number', minimum: 0 }, -1), []);
  assert.deepEqual(validate({ type: 'string', format: 'date-time' }, '2026-07-12T10:20:30Z'), []);
  assert.notDeepEqual(validate({ type: 'string', format: 'date-time' }, 'not-a-date'), []);
  assert.notDeepEqual(validate({ type: 'array', uniqueItems: true }, [{ a: 1, b: 2 }, { b: 2, a: 1 }]), []);
});

test('standard schema engine supports registered keywords and rejects unknown ones', () => {
  assert.deepEqual(validateSchemaKeywords({ type: 'string' }), []);
  assert.deepEqual(validateSchemaKeywords({ type: 'array', contains: { const: 'x' } }), []);
  assert.deepEqual(validateSchemaKeywords({ type: 'string', format: 'hostname' }), []);
  assert.match(validateSchemaKeywords({ type: 'string', inventedKeyword: true })[0], /strict mode: unknown keyword/);
  assert.notDeepEqual(validate({ type: 'array', contains: { const: 'x' } }, ['y']), []);
});

test('adoption evidence binds every public record to a full source commit', () => {
  const schema = JSON.parse(readFileSync(resolve('schemas/adoption-evidence.schema.json'), 'utf8'));
  const record = {
    recordId: 'ADOPTION-2026-001',
    consumerClass: 'generic backend',
    assistant: 'assistant 1.2.3',
    signals: ['installation'],
    sourceCommit: 'a'.repeat(40),
    sourceDigest: 'b'.repeat(64),
    validationEvidence: 'governance/evidence/adoption-001.json',
    validationEvidenceSha256: 'c'.repeat(64),
    consentEvidence: 'governance/evidence/adoption-001-consent.md',
    consentEvidenceSha256: 'd'.repeat(64),
    privacyReview: 'passed',
    observedAt: '2026-07-15T00:00:00Z',
    expiresAt: '2027-07-15T00:00:00Z',
  };
  const document = {
    $schema: '../schemas/adoption-evidence.schema.json',
    schemaVersion: 3,
    status: 'not-demonstrated',
    records: [record],
    minimumForDemonstrated: 2,
    collectionPolicy: {
      consentRequired: true,
      rawPrivateDataAllowed: false,
      retentionDays: 365,
      withdrawalMechanism: 'Contact a maintainer with the public record id.',
      allowedSignals: ['installation', 'activation', 'successful-workflow', 'maintenance-commitment'],
    },
    claimBoundary: 'One record does not demonstrate adoption.',
  };

  assert.deepEqual(validate(schema, document), []);
  const missing = structuredClone(document);
  delete missing.records[0].sourceCommit;
  assert.notDeepEqual(validate(schema, missing), []);
  const short = structuredClone(document);
  short.records[0].sourceCommit = 'abc';
  assert.notDeepEqual(validate(schema, short), []);
  const missingEvidenceDigest = structuredClone(document);
  delete missingEvidenceDigest.records[0].validationEvidenceSha256;
  assert.notDeepEqual(validate(schema, missingEvidenceDigest), []);

  for (const invalidPath of [
    '/governance/evidence/adoption.json',
    'https://example.com/adoption.json',
    'C:/evidence/adoption.json',
    '\\\\server\\share\\adoption.json',
    'governance\\evidence\\adoption.json',
    'governance/evidence/../adoption.json',
    'governance//evidence/adoption.json',
  ]) {
    const invalid = structuredClone(document);
    invalid.records[0].validationEvidence = invalidPath;
    assert.notDeepEqual(validate(schema, invalid), [], `expected invalid evidence path: ${invalidPath}`);
  }
  const exactDuplicate = structuredClone(document);
  exactDuplicate.status = 'demonstrated';
  exactDuplicate.records.push(structuredClone(exactDuplicate.records[0]));
  assert.notDeepEqual(validate(schema, exactDuplicate), []);
});

test('candidate core schema binds the candidate to a full workflow source commit', () => {
  const schema = JSON.parse(readFileSync(resolve('schemas/candidate-core.schema.json'), 'utf8'));
  const document = {
    schemaVersion: 3,
    candidate: {
      tag: 'v4.1.0-rc.1',
      number: 1,
      stableVersion: '4.1.0',
      commit: 'a'.repeat(40),
      workflowSourceCommit: 'b'.repeat(40),
      createdAt: '2026-07-16T00:00:00Z',
    },
    sourceDigests: {},
    controlBundle: { path: 'release-control-bundle.tar.gz', sha256: 'c'.repeat(64), bytes: 1 },
    releasePolicy: {
      status: 'READY',
      reasonCode: 'RELEASE_POLICY_READY',
      correctionIds: ['REL-TEST'],
      correctionsSha256: 'd'.repeat(64),
      maximumPermittedState: 'INSTALL_PROVEN',
    },
    artifacts: [{}, {}, {}],
    evidence: [{}],
  };

  assert.deepEqual(validate(schema, document), []);
  for (const workflowSourceCommit of [undefined, 'abc', 'B'.repeat(40)]) {
    const invalid = structuredClone(document);
    invalid.candidate.workflowSourceCommit = workflowSourceCommit;
    assert.notDeepEqual(validate(schema, invalid), []);
  }
  const oldSchema = structuredClone(document);
  oldSchema.schemaVersion = 2;
  assert.notDeepEqual(validate(schema, oldSchema), []);
});

test('performance schemas require a manifest binding and forbid self-reported sample counts', () => {
  const policySchema = JSON.parse(readFileSync(resolve('schemas/validation-performance.schema.json'), 'utf8'));
  const manifestSchema = JSON.parse(readFileSync(resolve('schemas/validation-performance-samples.schema.json'), 'utf8'));
  const engineeringEvidence = JSON.parse(readFileSync(resolve('governance/engineering-evidence.json'), 'utf8'));
  const manifest = JSON.parse(readFileSync(resolve('governance/evidence/validation-performance-samples.json'), 'utf8'));

  assert.deepEqual(validate(policySchema, engineeringEvidence.validationPerformance), []);
  assert.deepEqual(validate(manifestSchema, manifest), []);

  const selfReported = structuredClone(engineeringEvidence.validationPerformance);
  selfReported.profiles[0].sampleCount = 20;
  assert.notDeepEqual(validate(policySchema, selfReported), []);
  const unbound = structuredClone(engineeringEvidence.validationPerformance);
  delete unbound.profiles[0].sampleManifest;
  assert.notDeepEqual(validate(policySchema, unbound), []);
  const malformedAggregate = structuredClone(manifest);
  malformedAggregate.aggregate.sampleCount = '20';
  assert.notDeepEqual(validate(manifestSchema, malformedAggregate), []);
});

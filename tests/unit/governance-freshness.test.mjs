import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateGovernanceFreshness, main } from '../../scripts/validate-governance-freshness.mjs';

const fact = { id: 'x', ownerRole: 'owner', cadenceDays: 30, expiresAfterDays: 30, source: 'package.json', evidencePath: null, status: 'current' };

test('governance freshness keeps unavailable and stale facts visible', () => {
  const pending = evaluateGovernanceFreshness({ schemaVersion: 1, facts: [{ ...fact, reviewedAt: null }] }, new Date('2026-07-13T00:00:00Z'));
  assert.equal(pending.status, 'EVIDENCE_PENDING');
  const stale = evaluateGovernanceFreshness({ schemaVersion: 1, facts: [{ ...fact, reviewedAt: '2026-01-01' }] }, new Date('2026-07-13T00:00:00Z'));
  assert.equal(stale.status, 'STALE');
});

test('governance freshness rejects duplicate identities and missing sources', () => {
  assert.throws(() => evaluateGovernanceFreshness({ schemaVersion: 1, facts: [{ ...fact, reviewedAt: null }, { ...fact, reviewedAt: null }] }), /duplicate/u);
  assert.throws(() => evaluateGovernanceFreshness({ schemaVersion: 1, facts: [{ ...fact, source: 'missing.file', reviewedAt: null }] }), /does not exist/u);
});

test('governance freshness CLI distinguishes report, required-current, and usage exits', () => {
  const log = console.log;
  const error = console.error;
  const messages = [];
  console.log = (...values) => messages.push(values.join(' '));
  console.error = (...values) => messages.push(values.join(' '));
  try {
    assert.equal(main([]), 0);
    assert.equal(main(['--require-current']), 2);
    assert.equal(main(['--unknown']), 1);
  } finally {
    console.log = log;
    console.error = error;
  }
  assert.ok(messages.some((message) => message.includes('EVIDENCE_PENDING')));
  assert.ok(messages.some((message) => message.includes('Usage:')));
});

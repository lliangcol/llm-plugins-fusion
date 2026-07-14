import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeAudit, auditEvidenceFromOutput } from '../../scripts/audit-dependencies.mjs';

const parsed = {
  auditReportVersion: 2,
  vulnerabilities: {
    direct: { severity: 'moderate', isDirect: true, via: [{ source: 101 }] },
    parent: { severity: 'high', isDirect: true, via: ['nested'] },
    nested: { severity: 'high', isDirect: false, via: [{ source: 202 }] },
  },
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 1, high: 2, critical: 0, total: 3 } },
};

const policy = (overrides = {}) => ({ failOnSeverity: 'high', auditExceptions: [], ...overrides });

test('dependency audit honors the governed severity threshold after npm reports lower risks', () => {
  const result = analyzeAudit(parsed, policy());
  assert.deepEqual(result.policyViolations, ['nested', 'parent']);
  assert.equal(result.vulnerabilities.moderate, 1);
  assert.equal(result.policyViolations.includes('direct'), false);
});

test('dependency exceptions apply only to matching advisories and scopes', () => {
  const covered = analyzeAudit(parsed, policy({ auditExceptions: [{ advisory: '202', scope: 'dev-only' }] }));
  assert.deepEqual(covered.policyViolations, []);
  assert.deepEqual(covered.exceptionsApplied, [{ advisory: '202', scope: 'dev-only', dependencies: ['nested', 'parent'] }]);
  const wrongScope = analyzeAudit(parsed, policy({ auditExceptions: [{ advisory: '202', scope: 'direct' }] }));
  assert.deepEqual(wrongScope.policyViolations, ['nested']);
});

test('dependency audit rejects npm error envelopes and malformed totals instead of treating them as clean', () => {
  assert.throws(
    () => analyzeAudit({ error: { code: 'E503', summary: 'service unavailable' } }, policy()),
    /unsupported report version/,
  );
  assert.throws(
    () => analyzeAudit({ auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } }, policy()),
    /invalid info total/,
  );
  assert.throws(
    () => analyzeAudit({
      auditReportVersion: 2,
      vulnerabilities: { affected: { severity: 'high', isDirect: false, via: [{ source: 303 }] } },
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
    }, policy()),
    /high total does not match its findings/,
  );
  const blocked = auditEvidenceFromOutput(JSON.stringify({ error: { code: 'E503' } }), { commandFailed: true });
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.reasonCode, 'EXTERNAL_SERVICE_UNAVAILABLE');
  assert.throws(() => auditEvidenceFromOutput(JSON.stringify({ error: { code: 'E503' } })), /unsupported report version/);
  assert.throws(
    () => analyzeAudit({ ...parsed, auditReportVersion: 3 }, policy()),
    /unsupported report version/,
  );
});

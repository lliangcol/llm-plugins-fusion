import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_COMPATIBILITY_EVIDENCE_STATUSES,
  isCurrentCompatibilityEvidenceStatus,
} from '../../scripts/generate-compatibility-evidence.mjs';

test('compatibility evidence generator and validator share the current status set', () => {
  assert.deepEqual(CURRENT_COMPATIBILITY_EVIDENCE_STATUSES, ['exact', 'carried-forward']);
  for (const status of CURRENT_COMPATIBILITY_EVIDENCE_STATUSES) {
    assert.equal(isCurrentCompatibilityEvidenceStatus(status), true);
  }
  for (const status of ['historical', 'expired', 'declaration-only', 'current', null]) {
    assert.equal(isCurrentCompatibilityEvidenceStatus(status), false);
  }
});

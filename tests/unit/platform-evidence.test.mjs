import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePlatformCapabilities } from '../../scripts/validate-platform-evidence.mjs';

test('platform capability statuses keep Bash evidence distinct', () => {
  assert.deepEqual(evaluatePlatformCapabilities({ windows: false, hasBash: true, hasPowerShell: false }), { status: 'passed', reasonCode: 'CHECK_PASSED' });
  assert.deepEqual(evaluatePlatformCapabilities({ windows: true, hasBash: false, hasPowerShell: true }), { status: 'skipped', reasonCode: 'BASH_EXTERNAL_EVIDENCE_REQUIRED' });
  assert.deepEqual(evaluatePlatformCapabilities({ windows: true, hasBash: false, hasPowerShell: true, containerRequested: true, containerReady: false }), { status: 'skipped', reasonCode: 'CONTAINER_FALLBACK_UNAVAILABLE' });
  assert.deepEqual(evaluatePlatformCapabilities({ windows: false, hasBash: false, hasPowerShell: false }), { status: 'failed', reasonCode: 'REQUIRED_TOOL_UNAVAILABLE' });
});

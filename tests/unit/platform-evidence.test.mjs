import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePlatformCapabilities, validateContainerFallback } from '../../scripts/validate-platform-evidence.mjs';

test('platform capability statuses keep Bash evidence distinct', () => {
  assert.deepEqual(evaluatePlatformCapabilities({ windows: false, hasBash: true, hasPowerShell: false }), { status: 'passed', reasonCode: 'CHECK_PASSED' });
  assert.deepEqual(evaluatePlatformCapabilities({ windows: true, hasBash: false, hasPowerShell: true }), { status: 'skipped', reasonCode: 'BASH_EXTERNAL_EVIDENCE_REQUIRED' });
  assert.deepEqual(evaluatePlatformCapabilities({ windows: true, hasBash: false, hasPowerShell: true, containerRequested: true, containerReady: false }), { status: 'skipped', reasonCode: 'CONTAINER_FALLBACK_UNAVAILABLE' });
  assert.deepEqual(evaluatePlatformCapabilities({ windows: true, hasBash: false, hasPowerShell: true, containerRequested: true, containerReady: true }), { status: 'passed', reasonCode: 'CHECK_PASSED' });
  assert.deepEqual(evaluatePlatformCapabilities({ windows: false, hasBash: false, hasPowerShell: false, containerRequested: true, containerReady: true }), { status: 'passed', reasonCode: 'CHECK_PASSED' });
  assert.deepEqual(evaluatePlatformCapabilities({ windows: false, hasBash: false, hasPowerShell: false }), { status: 'failed', reasonCode: 'REQUIRED_TOOL_UNAVAILABLE' });
});

test('container fallback policy is explicit, digest-pinned, read-only, and fixed-argv', () => {
  const disabled = { automatic: false, enabled: false, imageDigest: null, network: 'none', mount: 'read-only', argv: ['bash', '-n'] };
  assert.equal(validateContainerFallback(disabled), false);
  const enabled = { ...disabled, enabled: true, imageDigest: `sha256:${'a'.repeat(64)}` };
  assert.equal(validateContainerFallback(enabled), true);
  assert.throws(() => validateContainerFallback({ ...enabled, imageDigest: null }), /digest-pinned/u);
  assert.throws(() => validateContainerFallback({ ...disabled, imageDigest: enabled.imageDigest }), /must not retain/u);
  assert.throws(() => validateContainerFallback({ ...enabled, argv: ['bash', '-c'] }), /argv/u);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { main as demoAllMain } from '../../scripts/demo-all.mjs';
import { checkOrWrite, renderDiagnosticsDocs } from '../../scripts/generate-diagnostics-docs.mjs';
import { buildBootstrapReport, main as bootstrapMain } from '../../scripts/validate-bootstrap.mjs';
import { diagnosticPlatform } from '../../scripts/lib/diagnostics.mjs';
import { capabilityLevel } from '../../scripts/doctor.mjs';

test('remediation entrypoints expose safe validation paths', async () => {
  assert.match(renderDiagnosticsDocs(), /CHECK_PASSED/u);
  assert.doesNotThrow(() => checkOrWrite());
  assert.equal(await demoAllMain(['unexpected']), 1);
  assert.equal(await bootstrapMain(['--output-json']), 1);
});

test('bootstrap diagnostics verify the write guard and record a comparable platform identity', async () => {
  const report = await buildBootstrapReport();
  assert.equal(report.platform, diagnosticPlatform());
  assert.equal(report.results.find((entry) => entry.check === 'write-guard')?.status, 'passed');
  assert.ok(report.results.every((entry) => entry.platform === report.platform));
});

test('doctor preserves the External capability level when guarded Codex authentication is available', () => {
  assert.equal(capabilityLevel({ guardedAvailable: true, codexAvailable: true, codexAuthenticated: true }), 'External');
  assert.equal(capabilityLevel({ guardedAvailable: true, codexAvailable: true, codexAuthenticated: false }), 'Guarded');
  assert.equal(capabilityLevel({ guardedAvailable: false, codexAvailable: true, codexAuthenticated: true }), 'Core');
});

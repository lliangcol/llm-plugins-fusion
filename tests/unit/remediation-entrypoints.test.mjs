import assert from 'node:assert/strict';
import test from 'node:test';
import { main as demoAllMain } from '../../scripts/demo-all.mjs';
import { checkOrWrite, renderDiagnosticsDocs } from '../../scripts/generate-diagnostics-docs.mjs';
import { main as bootstrapMain } from '../../scripts/validate-bootstrap.mjs';

test('remediation entrypoints expose safe validation paths', async () => {
  assert.match(renderDiagnosticsDocs(), /CHECK_PASSED/u);
  assert.doesNotThrow(() => checkOrWrite());
  assert.equal(await demoAllMain(['unexpected']), 1);
  assert.equal(await bootstrapMain(['--output-json']), 1);
});

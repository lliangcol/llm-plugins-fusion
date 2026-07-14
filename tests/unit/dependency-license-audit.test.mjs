import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canonicalInventory, evaluateLicense } from '../../scripts/audit-dependency-licenses.mjs';

const policy = { deniedLicenses: ['GPL-3.0-only', 'AGPL-3.0-or-later'], licenseReviews: [] };
const item = { name: 'fixture', version: '1.0.0' };
const cases = JSON.parse(readFileSync(new URL('../../fixtures/dependencies/licenses/cases.json', import.meta.url), 'utf8'));

for (const [expected, expressions] of Object.entries(cases)) {
  for (const expression of expressions) test(`${JSON.stringify(expression)} is ${expected}`, () => {
    assert.equal(evaluateLicense(expression, item, policy).status, expected);
  });
}

test('an owned unexpired OR selection can choose an allowed branch', () => {
  const expression = 'MIT OR GPL-3.0-only';
  const reviewed = { ...policy, licenseReviews: [{ package: 'fixture', version: '1.0.0', expression, decision: 'select', selectedLicense: 'MIT', reason: 'package uses MIT branch', owner: 'maintainers', expires: '2099-01-01' }] };
  assert.equal(evaluateLicense(expression, item, reviewed).status, 'passed');
});

test('expired reviews do not unblock metadata', () => {
  const reviewed = { ...policy, licenseReviews: [{ package: 'fixture', version: '1.0.0', expression: null, decision: 'allow', reason: 'manual review', owner: 'maintainers', expires: '2000-01-01' }] };
  assert.equal(evaluateLicense(null, item, reviewed).status, 'blocked');
});

test('workspace links resolve to matching source-controlled lock entries', () => {
  const lock = { packages: {
    '': { name: 'root', version: '1.0.0', license: 'MIT', devDependencies: { tool: '1.0.0' } },
    'node_modules/workspace': { link: true, resolved: 'packages/workspace' },
    'packages/workspace': { name: 'workspace', version: '1.0.0', license: 'MIT' },
    'node_modules/tool': { version: '1.0.0', license: 'MIT', dev: true },
    'node_modules/tool/node_modules/transitive': { version: '2.0.0', license: 'Apache-2.0' }
  } };
  const inventory = canonicalInventory(lock, new Map([['packages/workspace', { name: 'workspace', version: '1.0.0' }]]));
  assert.equal(inventory.length, 4);
  assert.equal(inventory.find((entry) => entry.name === 'tool').direct, true);
  assert.equal(inventory.find((entry) => entry.name === 'transitive').direct, false);
});

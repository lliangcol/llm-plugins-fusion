#!/usr/bin/env node
/** Validate lightweight CODEOWNERS, labels-as-code, ADR, and private-reporting contracts. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { RELEASE_CONTROL_ROOTS } from './build-release-control-bundle.mjs';
import { repoRoot } from './lib/repo-root.mjs';
import { isSensitivePath, parseCodeOwnerPaths, RELEASE_TRUST_PATHS } from './lib/pr-governance.mjs';

const root = repoRoot(import.meta.url);
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const owners = read('.github/CODEOWNERS');
const labels = read('.github/labels.yml');
const security = read('SECURITY.md');
const adr = read('docs/project/decisions/0001-truth-release-capability-evidence.md');
const reviewers = JSON.parse(read('governance/release-reviewers.json'));
const releaseWorkflowFiles = [
  '.github/workflows/release-candidate.yml',
  '.github/workflows/release.yml',
  '.github/workflows/promote-release.yml',
  '.github/workflows/release-recovery-drill.yml',
];
assert.match(owners, /^\*\s+@/m);
for (const path of ['/.github/', '/schemas/', '/workflow-specs/', '/framework/', '/nova-plugin/hooks/', '/nova-plugin/runtime/', '/scripts/lib/']) assert.match(owners, new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+@`, 'm'));
const names = [...labels.matchAll(/name:\s*"([^"]+)"/g)].map((match) => match[1]);
assert.ok(names.length >= 7);
assert.equal(new Set(names).size, names.length);
assert.ok(names.includes('needs evidence'));
assert.match(security, /private vulnerability reporting/i);
assert.match(adr, /Status: accepted/);
assert.ok(['configured', 'awaiting-owner-configuration'].includes(reviewers.status));
assert.ok(reviewers.sensitiveMinimumApprovals >= reviewers.standardMinimumApprovals);
assert.ok(reviewers.sensitivePaths.includes('scripts/lib/'));
const codeOwnerPaths = parseCodeOwnerPaths(owners);
for (const path of RELEASE_TRUST_PATHS) {
  assert.equal(isSensitivePath(path, codeOwnerPaths), true, `${path} is not explicitly protected by CODEOWNERS`);
  assert.equal(isSensitivePath(path, reviewers.sensitivePaths), true, `${path} is not protected by the release reviewer policy`);
}
for (const path of RELEASE_CONTROL_ROOTS) {
  assert.equal(RELEASE_TRUST_PATHS.includes(path), true, `${path} is a control-bundle root missing from the release trust inventory`);
  assert.equal(isSensitivePath(path, codeOwnerPaths), true, `${path} is a control-bundle root not explicitly protected by CODEOWNERS`);
  assert.equal(isSensitivePath(path, reviewers.sensitivePaths), true, `${path} is a control-bundle root not protected by release reviewer policy`);
}
const governedEntrypoints = new Set(RELEASE_TRUST_PATHS.filter((path) => !path.endsWith('/')));
for (const workflowFile of releaseWorkflowFiles) {
  const workflow = read(workflowFile);
  for (const match of workflow.matchAll(/\bnode\s+(scripts\/[A-Za-z0-9_./-]+\.mjs)\b/gu)) {
    assert.equal(governedEntrypoints.has(match[1]), true, `${workflowFile} invokes ungoverned release entrypoint ${match[1]}`);
  }
}
for (const entrypoint of governedEntrypoints) {
  const source = read(entrypoint);
  const moduleSpecifiers = [...source.matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(\.[^'"]+\.mjs)\1/gu)]
    .map((match) => match[2])
    .filter((specifier) => !specifier.includes('${'));
  for (const specifier of moduleSpecifiers) {
    const dependency = posix.normalize(posix.join(posix.dirname(entrypoint), specifier));
    if (dependency.startsWith('scripts/')
      && !dependency.startsWith('scripts/lib/')
      && !governedEntrypoints.has(dependency)) {
      assert.fail(`${entrypoint} imports ungoverned release trust dependency ${dependency}`);
    }
  }
}
assert.equal(new Set([...reviewers.trustedUsers, ...reviewers.trustedTeams]).size, reviewers.trustedUsers.length + reviewers.trustedTeams.length);
console.log(`OK community governance (${names.length} labels, CODEOWNERS, ADR, private reporting)`);

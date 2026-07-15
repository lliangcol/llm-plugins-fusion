#!/usr/bin/env node
/** Deterministic SPDX license audit over the committed npm lockfile. */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import parseSpdx from 'spdx-expression-parse';
import { repoRoot } from './lib/repo-root.mjs';

const require = createRequire(import.meta.url);
const deprecatedLicenseIds = new Set(require('spdx-license-ids/deprecated'));
const root = repoRoot(import.meta.url);
const lockPath = resolve(root, 'package-lock.json');
const policyPath = resolve(root, 'governance/dependency-policy.json');
const evidencePath = resolve(root, 'governance/dependency-license-evidence.json');
const markdownPath = resolve(root, 'docs/generated/dependency-license-audit.md');
const sha256 = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const load = (path) => JSON.parse(readFileSync(path, 'utf8'));

function astSummary(ast) {
  if (ast.license) return { license: ast.license, ...(ast.exception ? { exception: ast.exception } : {}) };
  return { conjunction: ast.conjunction, left: astSummary(ast.left), right: astSummary(ast.right) };
}

function evaluateAst(ast, denied) {
  if (ast.license) {
    if (ast.license.startsWith('LicenseRef-') || deprecatedLicenseIds.has(ast.license)) return 'blocked';
    return denied.has(ast.license) ? 'failed' : 'passed';
  }
  const left = evaluateAst(ast.left, denied);
  const right = evaluateAst(ast.right, denied);
  if (ast.conjunction === 'and') {
    if (left === 'failed' || right === 'failed') return 'failed';
    return left === 'blocked' || right === 'blocked' ? 'blocked' : 'passed';
  }
  if (left === right) return left;
  return 'blocked';
}

function evaluateSelectedAst(ast, selectedLicense, denied) {
  if (ast.license) return { containsSelection: ast.license === selectedLicense, status: evaluateAst(ast, denied) };
  const left = evaluateSelectedAst(ast.left, selectedLicense, denied);
  const right = evaluateSelectedAst(ast.right, selectedLicense, denied);
  if (ast.conjunction === 'or') {
    const selected = [left, right].filter((branch) => branch.containsSelection);
    if (selected.length === 0) return { containsSelection: false, status: 'blocked' };
    if (selected.some((branch) => branch.status === 'passed')) return { containsSelection: true, status: 'passed' };
    return { containsSelection: true, status: selected.some((branch) => branch.status === 'failed') ? 'failed' : 'blocked' };
  }
  if (left.status === 'failed' || right.status === 'failed') return { containsSelection: left.containsSelection || right.containsSelection, status: 'failed' };
  return {
    containsSelection: left.containsSelection || right.containsSelection,
    status: left.status === 'blocked' || right.status === 'blocked' ? 'blocked' : 'passed',
  };
}

function matchingReview(policy, item, expression, now) {
  const review = (policy.licenseReviews ?? []).find((candidate) => candidate.package === item.name
    && candidate.version === item.version && candidate.expression === expression);
  if (!review) return null;
  const expiry = Date.parse(`${review.expires}T23:59:59.999Z`);
  if (!Number.isFinite(expiry) || expiry < now) return null;
  return review;
}

export function evaluateLicense(expression, item, policy, now = Date.now()) {
  let ast = null;
  let status = 'blocked';
  let reasonCode = 'LICENSE_METADATA_UNRESOLVED';
  if (typeof expression === 'string') {
    try {
      ast = parseSpdx(expression);
      status = evaluateAst(ast, new Set(policy.deniedLicenses));
      reasonCode = status === 'failed' ? 'DENIED_LICENSE' : status === 'blocked' ? 'LICENSE_SELECTION_REQUIRED' : null;
    } catch {
      status = 'blocked';
    }
  }
  const review = matchingReview(policy, item, expression, now);
  if (review?.decision === 'deny') return { ast, status: 'failed', reasonCode: 'DENIED_LICENSE', review };
  if (review?.decision === 'allow' && status === 'blocked') return { ast, status: 'passed', reasonCode: null, review };
  if (review?.decision === 'select' && status === 'blocked' && ast) {
    const selection = typeof review.selectedLicense === 'string'
      ? evaluateSelectedAst(ast, review.selectedLicense, new Set(policy.deniedLicenses))
      : { containsSelection: false, status: 'blocked' };
    if (selection.containsSelection && selection.status === 'passed') {
      return { ast, status: 'passed', reasonCode: null, review };
    }
  }
  return { ast, status, reasonCode, review: null };
}

export function canonicalInventory(lock, manifests = new Map()) {
  if (!lock?.packages || typeof lock.packages !== 'object') throw new Error('package-lock.json packages inventory is missing');
  const rootEntry = lock.packages[''];
  if (!rootEntry?.name || !rootEntry?.version) throw new Error('package-lock.json root package metadata is incomplete');
  const directNames = new Set(Object.keys({ ...rootEntry.dependencies, ...rootEntry.devDependencies, ...rootEntry.optionalDependencies }));
  const workspacePaths = new Set(Object.values(lock.packages)
    .filter((entry) => entry.link === true && typeof entry.resolved === 'string')
    .map((entry) => entry.resolved.replaceAll('\\', '/')));
  const entries = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (entry.link === true) {
      const target = entry.resolved?.replaceAll('\\', '/');
      const source = target ? lock.packages[target] : null;
      if (!source?.name || !source?.version) throw new Error(`workspace link ${path} has no source-controlled lock entry`);
      const manifest = manifests.get(target);
      if (manifest && (manifest.name !== source.name || manifest.version !== source.version)) throw new Error(`workspace link ${path} does not match ${target}/package.json`);
      continue;
    }
    const workspace = workspacePaths.has(path);
    const name = entry.name ?? (path === '' ? rootEntry.name : path.split('node_modules/').at(-1));
    const version = entry.version;
    if (!name || !version) throw new Error(`lock entry ${path || '(root)'} is missing name/version`);
    const rootDependencyPath = `node_modules/${name}`;
    entries.push({
      path: path || '.', name, version,
      direct: path === '' || workspace || (directNames.has(name) && path === rootDependencyPath),
      workspace,
      development: entry.dev === true || path === '' || workspace,
      optional: entry.optional === true,
      licenseExpression: entry.license ?? manifests.get(path)?.license ?? null,
    });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

export function buildEvidence({ lock, policy, manifests = new Map(), lockRaw = JSON.stringify(lock), policyRaw = JSON.stringify(policy), now = Date.now() }) {
  const packages = canonicalInventory(lock, manifests).map((item) => {
    const result = evaluateLicense(item.licenseExpression, item, policy, now);
    return { ...item, ast: result.ast ? astSummary(result.ast) : null, status: result.status, reasonCode: result.reasonCode, review: result.review };
  });
  const counts = Object.fromEntries(['passed', 'failed', 'blocked'].map((status) => [status, packages.filter((item) => item.status === status).length]));
  const reviewsApplied = packages.filter((item) => item.review).map((item) => ({
    package: item.name, version: item.version, decision: item.review.decision, owner: item.review.owner, expires: item.review.expires,
  }));
  const cleanPackages = packages.map(({ review: _review, ...item }) => item);
  const status = counts.failed > 0 ? 'failed' : counts.blocked > 0 ? 'blocked' : 'passed';
  return {
    $schema: '../schemas/dependency-license-evidence.schema.json', schemaVersion: 1, status,
    reasonCode: status === 'failed' ? 'DENIED_LICENSE' : status === 'blocked' ? 'LICENSE_METADATA_UNRESOLVED' : null,
    lockDigest: sha256(lockRaw), policyDigest: sha256(policyRaw),
    scope: { root: true, workspaces: true, direct: true, transitive: true, development: true, runtimeDistributed: false },
    packages: cleanPackages, summary: { total: cleanPackages.length, ...counts }, reviewsApplied,
  };
}

function currentInputs() {
  const lockRaw = readFileSync(lockPath, 'utf8');
  const policyRaw = readFileSync(policyPath, 'utf8');
  const lock = JSON.parse(lockRaw);
  const manifests = new Map();
  const workspacePaths = new Set(Object.values(lock.packages ?? {})
    .filter((entry) => entry.link === true && typeof entry.resolved === 'string')
    .map((entry) => entry.resolved.replaceAll('\\', '/')));
  for (const path of ['', ...workspacePaths]) {
    if (path === '' || workspacePaths.has(path)) {
      const manifestPath = resolve(root, path || '.', 'package.json');
      if (existsSync(manifestPath)) manifests.set(path, load(manifestPath));
    }
  }
  return { lock, policy: JSON.parse(policyRaw), manifests, lockRaw, policyRaw };
}

function render(evidence) {
  return `# Dependency license audit\n\nGenerated from the committed lockfile and \`governance/dependency-policy.json\`.\n\n- Status: **${evidence.status}**${evidence.reasonCode ? ` (${evidence.reasonCode})` : ''}\n- Lock digest: \`${evidence.lockDigest}\`\n- Policy digest: \`${evidence.policyDigest}\`\n- Packages: total=${evidence.summary.total}, passed=${evidence.summary.passed}, failed=${evidence.summary.failed}, blocked=${evidence.summary.blocked}\n- Scope: root, workspaces, direct, transitive, optional, and development dependencies\n- Distributed Node runtime dependencies: **no**\n\nVulnerability audit and license audit are independent evidence chains. Missing, custom, deprecated, or ambiguous SPDX metadata does not become a clean result without an owned, expiring policy review.\n`;
}

export function main(args = process.argv.slice(2)) {
  try {
    if (args.length > 1 || (args.length === 1 && args[0] !== '--write')) throw new Error('Usage: node scripts/audit-dependency-licenses.mjs [--write]');
    const evidence = buildEvidence(currentInputs());
    const markdown = render(evidence);
    if (args[0] === '--write') {
      mkdirSync(dirname(evidencePath), { recursive: true });
      mkdirSync(dirname(markdownPath), { recursive: true });
      writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
      writeFileSync(markdownPath, markdown, 'utf8');
    } else {
      if (!existsSync(evidencePath) || readFileSync(evidencePath, 'utf8') !== `${JSON.stringify(evidence, null, 2)}\n`) throw new Error('dependency license evidence is stale; run with --write');
      if (!existsSync(markdownPath) || readFileSync(markdownPath, 'utf8') !== markdown) throw new Error('dependency license audit documentation is stale; run with --write');
    }
    console.log(`OK dependency license evidence (${evidence.status}, packages=${evidence.summary.total})`);
    return evidence.status === 'passed' ? 0 : 1;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();

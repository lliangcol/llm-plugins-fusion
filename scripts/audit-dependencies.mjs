#!/usr/bin/env node
/** Capture stable, public-safe npm audit evidence for maintainer-only dependencies. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const bundlePath = resolve(root, 'governance/dependency-governance.json');
const markdownPath = resolve(root, 'docs/generated/dependency-audit.md');
const policy = JSON.parse(readFileSync(bundlePath, 'utf8')).policy;
const digest = `sha256:${createHash('sha256').update(readFileSync(resolve(root, 'package-lock.json'))).digest('hex')}`;
export const severities = ['info', 'low', 'moderate', 'high', 'critical'];

const npmAudit = () => process.platform === 'win32'
  ? execFileSync('cmd.exe', ['/d', '/s', '/c', 'npm audit --json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  : execFileSync('npm', ['audit', '--json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function advisoryIds(name, vulnerabilities, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const item = vulnerabilities[name];
  if (!item) return [];
  return [...new Set((item.via ?? []).flatMap((via) => (
    typeof via === 'string' ? advisoryIds(via, vulnerabilities, seen) : via?.source == null ? [] : [String(via.source)]
  )))].sort();
}

function exceptionApplies(exception, finding) {
  if (!finding.advisories.includes(exception.advisory)) return false;
  if (exception.scope === 'direct') return finding.isDirect;
  if (exception.scope === 'transitive') return !finding.isDirect;
  if (exception.scope === 'dev-only') return true;
  return false;
}

function thresholdReached(severity, threshold) {
  return severities.indexOf(severity) >= severities.indexOf(threshold);
}

function assertAuditResult(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('npm audit response must be an object');
  if (parsed.auditReportVersion !== 2) throw new Error('npm audit response has an unsupported report version');
  if (!parsed.vulnerabilities || typeof parsed.vulnerabilities !== 'object' || Array.isArray(parsed.vulnerabilities)) {
    throw new Error('npm audit response is missing vulnerability findings');
  }
  const counts = parsed.metadata?.vulnerabilities;
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) throw new Error('npm audit response is missing vulnerability totals');
  for (const key of [...severities, 'total']) {
    if (!Number.isInteger(counts[key]) || counts[key] < 0) throw new Error(`npm audit response has an invalid ${key} total`);
  }
  for (const [dependency, item] of Object.entries(parsed.vulnerabilities)) {
    if (!dependency || !item || typeof item !== 'object' || Array.isArray(item)) throw new Error('npm audit response has an invalid finding');
    if (!severities.includes(item.severity) || typeof item.isDirect !== 'boolean' || !Array.isArray(item.via)) {
      throw new Error(`npm audit response has an invalid finding for ${dependency}`);
    }
  }
  const derived = Object.fromEntries(severities.map((severity) => [severity, 0]));
  for (const item of Object.values(parsed.vulnerabilities)) derived[item.severity] += 1;
  for (const severity of severities) {
    if (counts[severity] !== derived[severity]) throw new Error(`npm audit ${severity} total does not match its findings`);
  }
  if (counts.total !== Object.keys(parsed.vulnerabilities).length) throw new Error('npm audit total does not match its findings');
}

export function analyzeAudit(parsed, dependencyPolicy = policy) {
  assertAuditResult(parsed);
  const raw = parsed.vulnerabilities ?? {};
  const findings = Object.entries(raw).map(([dependency, item]) => ({
    dependency,
    severity: item.severity,
    isDirect: item.isDirect === true,
    advisories: advisoryIds(dependency, raw),
  })).sort((left, right) => left.dependency.localeCompare(right.dependency));
  const thresholdFindings = findings.filter((finding) => thresholdReached(finding.severity, dependencyPolicy.failOnSeverity));
  const policyViolations = thresholdFindings
    .filter((finding) => finding.advisories.length === 0 || !finding.advisories.every((advisory) => dependencyPolicy.auditExceptions.some((exception) => exception.advisory === advisory && exceptionApplies(exception, finding))))
    .map((finding) => finding.dependency);
  const exceptionsApplied = dependencyPolicy.auditExceptions
    .map((exception) => ({
      advisory: exception.advisory,
      scope: exception.scope,
      dependencies: thresholdFindings.filter((finding) => exceptionApplies(exception, finding)).map((finding) => finding.dependency),
    }))
    .filter((entry) => entry.dependencies.length > 0);
  const vulnerabilities = Object.fromEntries(severities.map((key) => [key, parsed.metadata?.vulnerabilities?.[key] ?? 0]));
  vulnerabilities.total = parsed.metadata?.vulnerabilities?.total ?? Object.values(vulnerabilities).reduce((sum, value) => sum + value, 0);
  return { vulnerabilities, findings, exceptionsApplied, policyViolations };
}

export function evidenceFromAudit(parsed, dependencyPolicy = policy) {
  const analysis = analyzeAudit(parsed, dependencyPolicy);
  const failed = analysis.policyViolations.length > 0;
  return {
    schemaVersion: 1,
    status: failed ? 'failed' : 'passed',
    reasonCode: failed ? 'DEPENDENCY_POLICY_VIOLATION' : null,
    source: 'npm-audit',
    lockDigest: digest,
    scope: { maintenanceDevOnly: true, runtimeDistributed: false },
    ...analysis,
  };
}

function blockedEvidence() {
  return {
    schemaVersion: 1,
    status: 'blocked',
    reasonCode: 'EXTERNAL_SERVICE_UNAVAILABLE',
    source: 'npm-audit',
    lockDigest: digest,
    scope: { maintenanceDevOnly: true, runtimeDistributed: false },
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
    findings: [],
    exceptionsApplied: [],
    policyViolations: [],
  };
}

export function auditEvidenceFromOutput(raw, { commandFailed = false } = {}) {
  const parsed = JSON.parse(raw);
  if (commandFailed && parsed && typeof parsed === 'object' && !parsed.vulnerabilities && (parsed.error || parsed.message)) {
    return blockedEvidence();
  }
  return evidenceFromAudit(parsed);
}

function render(evidence) {
  return `# Dependency audit evidence\n\nGenerated from \`governance/dependency-governance.json#/auditEvidence\`.\n\n- Status: **${evidence.status}**${evidence.reasonCode ? ` (${evidence.reasonCode})` : ''}\n- Source: npm audit against the committed lockfile\n- Scope: maintainer development dependencies; distributed Node runtime dependencies: **no**\n- Policy threshold: ${policy.failOnSeverity}\n- Lock digest: \`${evidence.lockDigest}\`\n- Vulnerabilities: ${severities.map((key) => `${key}=${evidence.vulnerabilities[key]}`).join(', ')}; total=${evidence.vulnerabilities.total}\n- Findings at any severity: ${evidence.findings.length}\n- Exceptions applied: ${evidence.exceptionsApplied.length}\n- Unexcepted policy violations: ${evidence.policyViolations.length}\n\nA blocked network audit is not a clean result. Exceptions require an owner, reason, applicable scope, and unexpired date; unmatched or partially covered advisories continue to fail closed.\n`;
}

export function validateEvidence(evidence, dependencyPolicy = policy, now = Date.now()) {
  if (evidence.lockDigest !== digest) throw new Error('dependency audit evidence lock digest is stale');
  for (const exception of dependencyPolicy.auditExceptions) {
    const expiry = Date.parse(`${exception.expires}T23:59:59.999Z`);
    if (!Number.isFinite(expiry) || expiry < now) throw new Error(`expired dependency exception: ${exception.advisory}`);
  }
  if (evidence.status === 'blocked') {
    if (evidence.reasonCode !== 'EXTERNAL_SERVICE_UNAVAILABLE') throw new Error('blocked dependency evidence requires EXTERNAL_SERVICE_UNAVAILABLE');
  } else {
    const recomputed = analyzeAudit({
      auditReportVersion: 2,
      vulnerabilities: Object.fromEntries(evidence.findings.map((finding) => [finding.dependency, {
        severity: finding.severity,
        isDirect: finding.isDirect,
        via: finding.advisories.map((source) => ({ source })),
      }])),
      metadata: { vulnerabilities: evidence.vulnerabilities },
    }, dependencyPolicy);
    if (JSON.stringify(recomputed.findings) !== JSON.stringify(evidence.findings)) throw new Error('dependency audit findings are not canonical');
    if (JSON.stringify(recomputed.policyViolations) !== JSON.stringify(evidence.policyViolations)) throw new Error('dependency audit policy violations are stale');
    if (JSON.stringify(recomputed.exceptionsApplied) !== JSON.stringify(evidence.exceptionsApplied)) throw new Error('dependency audit applied exceptions are stale');
    const expectedStatus = recomputed.policyViolations.length > 0 ? 'failed' : 'passed';
    if (evidence.status !== expectedStatus) throw new Error(`dependency audit status must be ${expectedStatus}`);
    if ((evidence.status === 'failed') !== (evidence.reasonCode === 'DEPENDENCY_POLICY_VIOLATION')) throw new Error('dependency audit reason code does not match status');
  }
  const expected = render(evidence);
  if (!existsSync(markdownPath) || readFileSync(markdownPath, 'utf8') !== expected) throw new Error('dependency audit Markdown is stale');
}

function capture() {
  let raw;
  try {
    raw = npmAudit();
  } catch (error) {
    const stdout = error.stdout?.toString();
    if (!stdout) return blockedEvidence();
    try {
      return auditEvidenceFromOutput(stdout, { commandFailed: true });
    } catch {
      throw error;
    }
  }
  return auditEvidenceFromOutput(raw);
}

export function main(args = process.argv.slice(2)) {
  try {
    if (args.some((arg) => arg !== '--write')) throw new Error('Usage: node scripts/audit-dependencies.mjs [--write]');
    if (args.includes('--write')) {
      const evidence = capture();
      mkdirSync(dirname(markdownPath), { recursive: true });
      const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
      writeFileSync(bundlePath, `${JSON.stringify({ ...bundle, auditEvidence: evidence }, null, 2)}\n`);
      writeFileSync(markdownPath, render(evidence));
    }
    const evidence = JSON.parse(readFileSync(bundlePath, 'utf8')).auditEvidence;
    validateEvidence(evidence);
    console.log(`OK dependency audit evidence (${evidence.status}, total=${evidence.vulnerabilities.total})`);
    return evidence.status === 'passed' ? 0 : 1;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();

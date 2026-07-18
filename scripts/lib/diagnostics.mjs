import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeArtifactFileAtomically } from './artifact-output.mjs';

const defaultRoot = resolve(import.meta.dirname, '../..');
const precedence = ['passed', 'skipped', 'warn', 'blocked', 'failed'];

export function diagnosticPlatform({ platform = process.platform, arch = process.arch, nodeVersion = process.versions.node } = {}) {
  const os = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : platform;
  const nodeMajor = String(nodeVersion).split('.')[0];
  return `${os}-${arch}-node${nodeMajor}`;
}

export function loadReasonRegistry(repoRoot = defaultRoot) {
  const data = JSON.parse(readFileSync(resolve(repoRoot, 'governance/diagnostic-reasons.json'), 'utf8'));
  const registry = new Map(data.reasons.map((entry) => [entry.code, entry]));
  if (registry.size !== data.reasons.length) throw new Error('diagnostic reason registry contains duplicate codes');
  return registry;
}

export function diagnosticResult(input, registry = loadReasonRegistry()) {
  const reason = registry.get(input.reasonCode);
  if (!reason) throw new Error(`unregistered diagnostic reason code: ${input.reasonCode}`);
  const result = {
    schemaVersion: 1,
    command: input.command,
    status: input.status,
    reasonCode: input.reasonCode,
    severity: input.severity ?? reason.severity,
    platform: input.platform ?? diagnosticPlatform(),
    check: input.check,
  };
  for (const key of ['expected', 'actual', 'evidencePath', 'skippedReason']) {
    if (input[key] !== undefined && input[key] !== null) result[key] = input[key];
  }
  result.remediation = input.remediation ?? reason.remediation;
  result.docsUrl = input.docsUrl ?? reason.docsUrl;
  return result;
}

export function diagnosticReport(command, results, platform = diagnosticPlatform()) {
  if (results.some((entry) => entry.command !== command)) throw new Error('diagnostic results must match the report command');
  if (results.some((entry) => entry.platform !== platform)) throw new Error('diagnostic results must match the report platform');
  const status = results.reduce((current, entry) => (
    precedence.indexOf(entry.status) > precedence.indexOf(current) ? entry.status : current
  ), 'passed');
  return { schemaVersion: 1, command, status, platform, results };
}

export function renderDiagnosticReport(report) {
  const rows = report.results.map((entry) => {
    const detail = entry.actual === undefined ? '' : `: ${typeof entry.actual === 'string' ? entry.actual : JSON.stringify(entry.actual)}`;
    return `${entry.status.toUpperCase()} ${entry.check} [${entry.reasonCode}]${detail}`;
  });
  return [`== ${report.command} diagnostics ==`, ...rows, '', `Status: ${report.status}`].join('\n');
}

export function writeDiagnosticReport(path, report, { repositoryRoot = defaultRoot } = {}) {
  writeArtifactFileAtomically(
    repositoryRoot,
    path,
    `${JSON.stringify(report, null, 2)}\n`,
    { label: 'diagnostic JSON output' },
  );
}

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const defaultRoot = resolve(import.meta.dirname, '../..');
const precedence = ['passed', 'skipped', 'warn', 'blocked', 'failed'];

export function loadReasonRegistry(repoRoot = defaultRoot) {
  const data = JSON.parse(readFileSync(resolve(repoRoot, 'governance/diagnostic-reasons.json'), 'utf8'));
  return new Map(data.reasons.map((entry) => [entry.code, entry]));
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
    platform: input.platform ?? process.platform,
    check: input.check,
  };
  for (const key of ['expected', 'actual', 'evidencePath', 'skippedReason']) {
    if (input[key] !== undefined && input[key] !== null) result[key] = input[key];
  }
  result.remediation = input.remediation ?? reason.remediation;
  result.docsUrl = input.docsUrl ?? reason.docsUrl;
  return result;
}

export function diagnosticReport(command, results, platform = process.platform) {
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

export function writeDiagnosticReport(path, report) {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

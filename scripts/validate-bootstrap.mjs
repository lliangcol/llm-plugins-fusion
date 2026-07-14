#!/usr/bin/env node
/** Read-only bootstrap diagnostics. This command never installs dependencies. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REQUIRED_NODE_MAJOR, nodeMajorVersion } from './lib/node-version.mjs';
import { captureProcess } from './lib/process-runner.mjs';
import { resolveBashCommand } from './lib/bash-command.mjs';
import { diagnosticReport, diagnosticResult, loadReasonRegistry, renderDiagnosticReport, writeDiagnosticReport } from './lib/diagnostics.mjs';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);

async function processCheck(command, args = ['--version']) {
  return captureProcess(`bootstrap ${command}`, command, args, { cwd: root, timeoutMs: 30_000 });
}

export async function buildBootstrapReport() {
  const command = 'validate:bootstrap';
  const registry = loadReasonRegistry(root);
  const results = [];
  const add = (input) => results.push(diagnosticResult({ command, ...input }, registry));
  const major = nodeMajorVersion();
  add({ check: 'node-version', status: major !== null && major >= REQUIRED_NODE_MAJOR ? 'passed' : 'failed', reasonCode: major !== null && major >= REQUIRED_NODE_MAJOR ? 'CHECK_PASSED' : 'NODE_VERSION_UNSUPPORTED', expected: `>=${REQUIRED_NODE_MAJOR}`, actual: process.version });
  add({ check: 'package-lock', status: existsSync(resolve(root, 'package-lock.json')) ? 'passed' : 'failed', reasonCode: existsSync(resolve(root, 'package-lock.json')) ? 'CHECK_PASSED' : 'LOCKFILE_MISSING', expected: 'tracked package-lock.json', actual: existsSync(resolve(root, 'package-lock.json')) ? 'present' : 'missing' });
  const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  let installedAjv = null;
  try { installedAjv = JSON.parse(readFileSync(resolve(root, 'node_modules/ajv/package.json'), 'utf8')).version; } catch { /* reported below */ }
  add({ check: 'locked-toolchain', status: installedAjv === packageJson.devDependencies.ajv ? 'passed' : 'blocked', reasonCode: installedAjv === packageJson.devDependencies.ajv ? 'CHECK_PASSED' : 'TOOLCHAIN_NOT_INSTALLED', expected: `ajv@${packageJson.devDependencies.ajv}`, actual: installedAjv ?? 'not installed' });
  const bash = await processCheck(resolveBashCommand());
  add({ check: 'bash', status: bash.ok ? 'passed' : 'skipped', reasonCode: bash.ok ? 'CHECK_PASSED' : 'BASH_CAPABILITY_UNAVAILABLE', actual: bash.ok ? (bash.stdout || bash.stderr).split(/\r?\n/u)[0] : 'not available', skippedReason: bash.ok ? undefined : 'Bash-dependent gates require an installed Bash runtime.' });
  for (const tool of ['claude', 'codex']) {
    const result = await processCheck(tool);
    add({ check: `${tool}-cli`, status: result.ok ? 'passed' : 'skipped', reasonCode: result.ok ? 'CHECK_PASSED' : 'OPTIONAL_TOOL_UNAVAILABLE', actual: result.ok ? (result.stdout || result.stderr).split(/\r?\n/u)[0] : 'not available', skippedReason: result.ok ? undefined : `${tool} CLI is optional for local deterministic checks.` });
  }
  for (const [check, script] of [['registry-drift', 'scripts/generate-registry.mjs'], ['project-state-drift', 'scripts/generate-project-state.mjs'], ['fact-graph-drift', 'scripts/generate-fact-graph.mjs']]) {
    const result = await processCheck(process.execPath, [script]);
    add({ check, status: result.ok ? 'passed' : 'failed', reasonCode: result.ok ? 'CHECK_PASSED' : 'GENERATED_DRIFT', actual: result.ok ? 'current' : 'stale' });
  }
  return diagnosticReport(command, results);
}

export async function main(args = process.argv.slice(2)) {
  try {
    const json = args.includes('--json');
    const outputAt = args.indexOf('--output-json');
    const output = outputAt === -1 ? null : args[outputAt + 1];
    if (args.some((arg, index) => !['--json', '--output-json'].includes(arg) && index !== outputAt + 1) || (outputAt !== -1 && !output)) throw new Error('Usage: node scripts/validate-bootstrap.mjs [--json] [--output-json <path>]');
    const report = await buildBootstrapReport();
    if (output) writeDiagnosticReport(output, report);
    console.log(json ? JSON.stringify(report, null, 2) : renderDiagnosticReport(report));
    return report.status === 'failed' ? 1 : 0;
  } catch (error) { console.error(`ERROR ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();

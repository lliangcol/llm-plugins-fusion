#!/usr/bin/env node
/** Read-only repository doctor with shared text and JSON diagnostics. */
import { linkSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REQUIRED_NODE_MAJOR, nodeMajorVersion } from './lib/node-version.mjs';
import { resolveBashCommand } from './lib/bash-command.mjs';
import { captureProcess } from './lib/process-runner.mjs';
import { diagnosticReport, diagnosticResult, loadReasonRegistry, renderDiagnosticReport, writeDiagnosticReport } from './lib/diagnostics.mjs';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

async function commandResult(command, args = ['--version']) {
  const result = await captureProcess(`doctor ${command}`, command, args, { cwd: root, timeoutMs: 30_000 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.split(/\r?\n/u).map((line) => line.trim()).find(Boolean);
  return { ok: result.ok, detail: output || result.errorMessage || 'not available' };
}

async function gitValue(args) {
  const result = await captureProcess(`git ${args.join(' ')}`, 'git', args, { cwd: root, timeoutMs: 30_000 });
  return result.ok ? (result.stdout.trim() || null) : null;
}

export function capabilityLevel({ guardedAvailable, codexAvailable, codexAuthenticated }) {
  if (guardedAvailable && codexAvailable && codexAuthenticated) return 'External';
  return guardedAvailable ? 'Guarded' : 'Core';
}

export async function buildDoctorReport() {
  const command = 'doctor';
  const registry = loadReasonRegistry(root);
  const results = [];
  const add = (input) => results.push(diagnosticResult({ command, ...input }, registry));
  const plugin = readJson('nova-plugin/.claude-plugin/plugin.json');
  const packageJson = readJson('package.json');
  const metadata = readJson('.claude-plugin/marketplace.metadata.json');
  const metadataEntry = metadata.plugins?.find((entry) => entry.name === plugin.name);

  const major = nodeMajorVersion();
  add({ check: 'Node.js', status: major !== null && major >= REQUIRED_NODE_MAJOR ? 'passed' : 'failed', reasonCode: major !== null && major >= REQUIRED_NODE_MAJOR ? 'CHECK_PASSED' : 'NODE_VERSION_UNSUPPORTED', expected: `>=${REQUIRED_NODE_MAJOR}`, actual: process.version });
  const git = await commandResult('git');
  add({ check: 'Git', status: git.ok ? 'passed' : 'failed', reasonCode: git.ok ? 'CHECK_PASSED' : 'REQUIRED_TOOL_UNAVAILABLE', actual: git.detail });
  let codexAvailable = false;
  for (const [label, tool] of [['Claude CLI', 'claude'], ['Codex CLI', 'codex'], ['ShellCheck', 'shellcheck'], ['actionlint', 'actionlint']]) {
    const result = await commandResult(tool);
    if (tool === 'codex') codexAvailable = result.ok;
    add({ check: label, status: result.ok ? 'passed' : 'skipped', reasonCode: result.ok ? 'CHECK_PASSED' : 'OPTIONAL_TOOL_UNAVAILABLE', actual: result.detail, skippedReason: result.ok ? undefined : `${label} is optional for deterministic local checks.` });
  }
  const bashName = resolveBashCommand();
  const bash = await commandResult(bashName);
  const bashCapability = bash.ok ? await commandResult(bashName, ['-c', 'set -euo pipefail; values=(); values+=(ok); [[ ${#values[@]} -eq 1 ]]; cat <(printf compatible)']) : { ok: false, detail: 'not available' };
  add({ check: 'Bash', status: bash.ok && bashCapability.ok && bashCapability.detail === 'compatible' ? 'passed' : 'skipped', reasonCode: bash.ok && bashCapability.ok && bashCapability.detail === 'compatible' ? 'CHECK_PASSED' : 'BASH_CAPABILITY_UNAVAILABLE', actual: bash.ok ? bash.detail : 'not available', skippedReason: bash.ok && bashCapability.ok ? undefined : 'Bash-dependent checks cannot run.' });
  const auth = await commandResult('codex', ['login', 'status']);
  add({ check: 'Codex authentication', status: auth.ok ? 'passed' : 'skipped', reasonCode: auth.ok ? 'CHECK_PASSED' : 'OPTIONAL_AUTH_UNAVAILABLE', actual: auth.detail, skippedReason: auth.ok ? undefined : 'Credentialed assistant evidence is optional and separately authorized.' });

  let guardedAvailable = false;
  if (process.env.NOVA_WRITE_GUARD_DISABLED === '1') add({ check: 'Write guard', status: 'warn', reasonCode: 'WRITE_GUARD_DISABLED', actual: 'disabled by environment' });
  else {
    const hooks = readJson('nova-plugin/hooks/hooks.json');
    const matcher = hooks.hooks?.PreToolUse?.[0]?.matcher;
    const hook = hooks.hooks?.PreToolUse?.[0]?.hooks?.[0];
    if (matcher !== 'Write|Edit|NotebookEdit' || hook?.command !== 'bash' || hook?.args?.[0] !== '${CLAUDE_PLUGIN_ROOT}/hooks/scripts/pre-write-check.sh') add({ check: 'Write guard', status: 'failed', reasonCode: 'WRITE_GUARD_INVALID', actual: 'launcher contract mismatch' });
    else {
      const temp = mkdtempSync(resolve(tmpdir(), 'nova-doctor-links-'));
      let hardLinksSupported = false;
      try { const first = resolve(temp, 'first'); writeFileSync(first, 'test'); linkSync(first, resolve(temp, 'second')); hardLinksSupported = statSync(first).nlink === 2; }
      catch { hardLinksSupported = false; } finally { rmSync(temp, { recursive: true, force: true }); }
      guardedAvailable = major !== null && major >= REQUIRED_NODE_MAJOR && hardLinksSupported;
      add({ check: 'Write guard', status: guardedAvailable ? 'passed' : 'warn', reasonCode: guardedAvailable ? 'CHECK_PASSED' : 'WRITE_GUARD_CAPABILITY_UNAVAILABLE', actual: guardedAvailable ? 'launcher and nlink semantics verified' : 'platform capability unavailable' });
    }
  }

  add({ check: 'Package/plugin version', status: packageJson.version === plugin.version ? 'passed' : 'failed', reasonCode: packageJson.version === plugin.version ? 'CHECK_PASSED' : 'VERSION_MISMATCH', expected: plugin.version, actual: packageJson.version });
  add({ check: 'Registry metadata date', status: metadataEntry?.['last-updated'] ? 'passed' : 'warn', reasonCode: metadataEntry?.['last-updated'] ? 'CHECK_PASSED' : 'METADATA_MISSING', actual: metadataEntry?.['last-updated'] ?? 'missing' });
  const worktree = await gitValue(['status', '--short']);
  add({ check: 'Git working tree', status: worktree ? 'warn' : 'passed', reasonCode: worktree ? 'WORKTREE_DIRTY' : 'CHECK_PASSED', actual: worktree ? 'working tree has changes' : 'clean' });
  const tag = await gitValue(['describe', '--tags', '--exact-match', 'HEAD']);
  add({ check: 'Exact release tag', status: tag ? 'passed' : 'warn', reasonCode: tag ? 'CHECK_PASSED' : 'DEVELOPMENT_SNAPSHOT', actual: tag ?? 'none' });
  const drift = await commandResult(process.execPath, ['scripts/generate-registry.mjs']);
  add({ check: 'Generated registry drift', status: drift.ok ? 'passed' : 'failed', reasonCode: drift.ok ? 'CHECK_PASSED' : 'GENERATED_DRIFT', actual: drift.ok ? 'current' : drift.detail });
  return { report: diagnosticReport(command, results), capability: capabilityLevel({ guardedAvailable, codexAvailable, codexAuthenticated: auth.ok }) };
}

export async function main(args = process.argv.slice(2)) {
  try {
    const json = args.includes('--json');
    const outputAt = args.indexOf('--output-json');
    const output = outputAt === -1 ? null : args[outputAt + 1];
    if (args.some((arg, index) => !['--json', '--output-json'].includes(arg) && index !== outputAt + 1) || (outputAt !== -1 && !output)) throw new Error('Usage: node scripts/doctor.mjs [--json] [--output-json <path>]');
    const { report, capability } = await buildDoctorReport();
    if (output) writeDiagnosticReport(output, report);
    if (json) console.log(JSON.stringify(report, null, 2));
    else console.log(`${renderDiagnosticReport(report)}\nCapability level: ${capability}`);
    return report.status === 'failed' ? 1 : 0;
  } catch (error) { console.error(`ERROR ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main();

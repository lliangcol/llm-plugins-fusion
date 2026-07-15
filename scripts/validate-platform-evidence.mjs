#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';

const root = repoRoot(import.meta.url);
const sourcePath = resolve(root, 'governance/engineering-evidence.json');
const targetPath = resolve(root, 'docs/generated/platform-evidence.md');

export function evaluatePlatformCapabilities({ windows, hasBash, hasPowerShell, containerRequested = false, containerReady = false }) {
  if (hasBash) return { status: 'passed', reasonCode: 'CHECK_PASSED' };
  if (containerRequested) return containerReady
    ? { status: 'passed', reasonCode: 'CHECK_PASSED' }
    : { status: 'skipped', reasonCode: 'CONTAINER_FALLBACK_UNAVAILABLE' };
  if (!windows) return { status: 'failed', reasonCode: 'REQUIRED_TOOL_UNAVAILABLE' };
  if (windows && hasPowerShell) return { status: 'skipped', reasonCode: 'BASH_EXTERNAL_EVIDENCE_REQUIRED' };
  return { status: 'failed', reasonCode: 'REQUIRED_TOOL_UNAVAILABLE' };
}

export function validateContainerFallback(config) {
  if (config?.automatic !== false || config.network !== 'none' || config.mount !== 'read-only') throw new Error('container fallback must remain explicit, network-disabled, and read-only');
  if (JSON.stringify(config.argv) !== JSON.stringify(['bash', '-n'])) throw new Error('container fallback argv must remain fixed to bash -n');
  const digestReady = /^sha256:[a-f0-9]{64}$/u.test(config.imageDigest ?? '');
  if (config.enabled && !digestReady) throw new Error('enabled container fallback requires an approved digest-pinned image');
  if (!config.enabled && config.imageDigest !== null) throw new Error('disabled container fallback must not retain an active image digest');
  return config.enabled;
}

function render(source) {
  const rows = source.tasks.map((item) => `| \`${item.id}\` | \`${item.classification}\` | ${item.localWindowsPath ?? 'none'} | ${item.evidenceStrength} | \`${item.reasonCode}\` |`).join('\n');
  return `# Platform evidence matrix\n\nGenerated from \`governance/engineering-evidence.json#/platformEvidence\`.\n\n| Task | Classification | No-Bash Windows path | Evidence strength | Reason code |\n| --- | --- | --- | --- | --- |\n${rows}\n\nPowerShell and Node evidence never imply that Bash syntax or launcher behavior passed. Git Bash, WSL, and CI are valid only when Bash actually runs. Container fallback is not automatic; it requires an explicit flag, an approved digest-pinned image, read-only mounts, disabled networking, and fixed argv. The current policy has no approved container image, so the container path remains External evidence.\n`;
}

export function main(args = process.argv.slice(2)) {
  try {
    const write = args.includes('--write');
    const container = args.includes('--container-fallback');
    if (args.some((arg) => !['--write', '--container-fallback'].includes(arg))) throw new Error('Usage: node scripts/validate-platform-evidence.mjs [--write] [--container-fallback]');
    const source = JSON.parse(readFileSync(sourcePath, 'utf8')).platformEvidence;
    const containerEnabled = validateContainerFallback(source.containerFallback);
    const reasonCodes = new Set(JSON.parse(readFileSync(resolve(root, 'governance/diagnostic-reasons.json'), 'utf8')).reasons.map((item) => item.code));
    for (const task of source.tasks) if (!reasonCodes.has(task.reasonCode)) throw new Error(`unregistered platform evidence reason code: ${task.reasonCode}`);
    if (container && !containerEnabled) throw new Error('container fallback unavailable: no approved digest-pinned image; use Git Bash, WSL, or CI Bash evidence');
    const expected = render(source);
    if (write) writeFileSync(targetPath, expected, 'utf8');
    else if (!existsSync(targetPath) || readFileSync(targetPath, 'utf8') !== expected) throw new Error('platform evidence documentation is stale; run with --write');
    console.log(`OK platform evidence matrix (${source.tasks.length} tasks; container fallback ${containerEnabled ? 'enabled' : 'disabled'})`);
    return 0;
  } catch (error) { console.error(`ERROR ${error.message}`); return 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();

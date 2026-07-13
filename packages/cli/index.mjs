import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileDirectory, buildArtifact } from '../compiler/index.mjs';
import { evaluateBundle, testConformance } from '../conformance/index.mjs';
import { inspectSpecBundle, loadSpecBundle } from '../spec/index.mjs';

export const EXIT = Object.freeze({ OK: 0, USAGE: 2, VALIDATION: 3, IO: 4, CONFORMANCE: 5 });
const json = (value) => `${JSON.stringify(value)}\n`;

function option(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw Object.assign(new Error(`${name} requires a value`), { exitCode: EXIT.USAGE });
  return args[index + 1];
}

function init(root) {
  mkdirSync(resolve(root, 'adapters'), { recursive: true });
  const files = {
    'framework.json': { schemaVersion: 4 },
    'product.json': { schemaVersion: 2, pluginNamespace: 'example-flow', expectedWorkflowCount: 1, stages: ['intake'], primaryEntrypoints: ['triage'], runtimeCompatibility: { 'example-host': '1.0.0' }, adapterDefinitions: ['adapters/example.json'], agents: ['coordinator'], packs: [], tools: ['Inspect'] },
    'workflows.json': { schemaVersion: 5, contractVersions: { workflow: '5.0.0', runtime: '3.0.0', adapter: '2.0.0' }, permissionProfiles: { inspect: { allowedTools: ['Inspect'], disallowedTools: [], permissionPolicy: { workspaceRead: 'preapproved', workspaceWrite: 'denied', shell: 'denied', network: 'denied', credentials: 'denied', userScopeMutation: 'denied', externalPublish: 'denied', gitHistoryMutation: 'denied' } } }, workflows: [{ id: 'triage', stage: 'intake', ownerAgents: ['coordinator'], recommendedPacks: [], requiredInputs: ['REQUEST'], outputContract: 'triage-v1', risk: 'none', modelInvocable: true, subagentSafe: true, permissionProfile: 'inspect', legacyAlias: 'example-triage', contractPath: 'contracts/triage.md', canonicalSurfaceId: 'triage', variantPreset: {}, compatibilityAlias: false }] },
    'behaviors.json': { schemaVersion: 1, behaviors: [{ id: 'triage', purpose: 'Triage a request.', inputs: [{ name: 'REQUEST', required: true, aliases: [], description: 'Request.' }], decisionTable: [{ when: 'REQUEST exists.', action: 'Triage it.' }], invariants: ['No writes.'], stopConditions: ['REQUEST missing.'], workflowSteps: [{ id: 'triage', action: 'Triage.' }], deviationPolicy: { mode: 'forbid', instructions: 'No deviation.' }, output: { mode: 'chat', fields: [{ name: 'next step', required: true, description: 'Next step.' }], order: ['next step'], severityLevels: [] }, validation: ['One next step.'], failureOutput: { fields: ['status'], order: ['status'] } }] },
    'adapters/example.json': { schemaVersion: 1, id: 'example', enforcement: 'advisory', declaredLevel: 'L1', maximumSupportedLevel: 'L2', invocation: { kind: 'contract-manifest', prefix: 'example:' }, evidenceRequiredFor: ['L2'] },
  };
  for (const [path, value] of Object.entries(files)) writeFileSync(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return { files: Object.keys(files).sort() };
}

export async function runCli(args, io = process) {
  const command = args[0];
  if (!['init', 'validate', 'build', 'test', 'eval', 'doctor', 'inspect', 'migrate'].includes(command)) return { exitCode: EXIT.USAGE, output: { ok: false, command: command ?? null, error: 'unknown-command' } };
  try {
    const root = resolve(option(args, '--root', '.'));
    let result;
    if (command === 'init') result = init(root);
    else if (command === 'doctor') result = { node: process.versions.node, platform: process.platform, architecture: process.arch, supported: Number(process.versions.node.split('.')[0]) >= 22 };
    else if (command === 'validate') { const compiled = compileDirectory(root); const conformance = testConformance(compiled); if (!conformance.passed) return { exitCode: EXIT.VALIDATION, output: { ok: false, command, result: conformance } }; result = { valid: true, ...inspectSpecBundle(compiled) }; }
    else if (command === 'inspect') result = inspectSpecBundle(loadSpecBundle(root));
    else if (command === 'test') { result = testConformance(compileDirectory(root)); if (!result.passed) return { exitCode: EXIT.CONFORMANCE, output: { ok: false, command, result } }; }
    else if (command === 'eval') result = evaluateBundle(compileDirectory(root));
    else if (command === 'build') { const out = option(args, '--out'); if (!out) throw Object.assign(new Error('--out is required'), { exitCode: EXIT.USAGE }); const artifact = buildArtifact(compileDirectory(root)); mkdirSync(resolve(root, out, '..'), { recursive: true }); writeFileSync(resolve(root, out), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8'); result = { output: resolve(root, out), workflowCount: artifact.workflows.length }; }
    else if (command === 'migrate') { const { migrateWorkflowSpec, migrateBehaviorSpec } = await import('../../scripts/migrate-v6-contracts.mjs'); const bundle = loadSpecBundle(root); const workflows = migrateWorkflowSpec(bundle.workflows, bundle.behaviors); const behaviors = migrateBehaviorSpec(bundle.behaviors); if (args.includes('--write')) { writeFileSync(resolve(root, 'workflows.v6.json'), `${JSON.stringify(workflows, null, 2)}\n`); writeFileSync(resolve(root, 'behaviors.v2.json'), `${JSON.stringify(behaviors, null, 2)}\n`); } result = { write: args.includes('--write'), workflowCount: workflows.workflows.length, workflowSchemaVersion: 6, behaviorSchemaVersion: 2 }; }
    return { exitCode: EXIT.OK, output: { ok: true, command, result } };
  } catch (error) { return { exitCode: error.exitCode ?? (error instanceof SyntaxError ? EXIT.VALIDATION : EXIT.IO), output: { ok: false, command, error: error.message } }; }
}

export async function main(args = process.argv.slice(2), io = process) {
  const result = await runCli(args, io);
  (result.exitCode === 0 ? io.stdout : io.stderr).write(json(result.output));
  return result.exitCode;
}

#!/usr/bin/env node
/** Run one OAuth-authenticated, read-only namespaced route invocation. */

import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureProcess, runProcess } from './lib/process-runner.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const fixedPrompt = '/nova-plugin:route REQUEST="Review a public README change before editing and recommend the next workflow." DEPTH=brief';
const routeContractSource = JSON.parse(readFileSync(resolve(root, 'nova-plugin/runtime/route-output-contract.json'), 'utf8'));
const routePermissionSource = JSON.parse(readFileSync(resolve(root, 'nova-plugin/runtime/workflow-permissions.json'), 'utf8'));
const routePermission = routePermissionSource.workflows.find((workflow) => workflow.id === 'route');
if (!routePermission) throw new Error('route workflow permission is missing');
export const routeOutputContract = Object.freeze({
  ...routeContractSource,
  fields: Object.freeze(routeContractSource.fields.map((field) => Object.freeze(field))),
  requiredFields: Object.freeze(routeContractSource.fields.map((field) => field.label)),
  ownerAgents: Object.freeze(Object.fromEntries(Object.entries(routeContractSource.ownerAgents).map(([id, agents]) => [id, Object.freeze(agents)]))),
});
export const routeSystemPrompt = `This is an automated installation/invocation/safety smoke for an explicitly invoked /nova-plugin:route command; it is not workflow-quality evidence. Follow the loaded route command and nova-route skill. The final response MUST start with exactly "${routeOutputContract.heading}" and then contain exactly these eight Markdown bullet labels in this order: ${routeOutputContract.requiredFields.join(' ')} Use no preface, alternate heading level, table, renamed field, or closing text. Copy these five lines verbatim: "- Canonical skill: nova-review" "- Command alias (optional): /nova-plugin:review" "- Variant parameters: {}" "- Core agent: reviewer" "- Capability packs: docs". Fill the remaining three values without adding any other lines.`;
export const routeSystemPromptSha256 = sha256(routeSystemPrompt);
export const routeMaxTurns = 8;
export const routeAllowedTools = Object.freeze([
  'Skill(nova-plugin:route)',
  ...routePermission.allowedTools,
]);
export const routeDisallowedTools = Object.freeze(['Write', 'Edit', 'NotebookEdit', 'Bash']);
const competingCredentialVariables = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
];

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fieldValue(result, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = result.match(new RegExp(`^\\s*(?:[-*]\\s*)?${escaped}\\s*(.+?)\\s*$`, 'mi'));
  if (!match) throw new Error(`route output is missing ${label}`);
  return match[1].replaceAll('`', '').trim();
}

function validateInventoryField(value, allowedValues, label) {
  const connectors = new Set(['and', 'or', 'then', 'plus']);
  const tokens = (value.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [])
    .filter((token) => !connectors.has(token));
  if (tokens.length === 0) throw new Error(`route output ${label} is empty`);
  const invalid = tokens.filter((token) => !allowedValues.has(token));
  if (invalid.length) throw new Error(`route output invented ${label}: ${[...new Set(invalid)].join(', ')}`);
  return [...new Set(tokens)].sort();
}

export function loadRouteInventory(pluginDir, permissionSpec) {
  const agents = readdirSync(resolve(pluginDir, 'agents'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
  const packs = readdirSync(resolve(pluginDir, 'packs'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return {
    commandIds: [...permissionSpec.expectedInventory.commandIds],
    skillNames: [...permissionSpec.expectedInventory.skillNames],
    workflows: permissionSpec.workflows.map((workflow) => ({
      id: workflow.id,
      canonicalSkill: `nova-${workflow.canonicalSurfaceId}`,
      ownerAgents: [...(routeOutputContract.ownerAgents[workflow.id] ?? [])],
    })),
    agents,
    packs,
  };
}

export function validateRouteResult(result, routeInventory) {
  const requiredFields = routeOutputContract.requiredFields;
  const nonEmptyLines = result.split(/\r?\n/).filter((line) => line.trim());
  if (nonEmptyLines[0] !== routeOutputContract.heading) {
    throw new Error(`route output does not start with "${routeOutputContract.heading}"`);
  }
  for (const field of requiredFields) {
    if (!result.includes(field)) throw new Error(`route output is missing ${field}`);
  }
  if (nonEmptyLines.length !== requiredFields.length + 1) {
    throw new Error('route output does not contain exactly the heading and eight field lines');
  }
  for (let index = 0; index < requiredFields.length; index += 1) {
    const field = requiredFields[index];
    const prefix = `- ${field}`;
    const line = nonEmptyLines[index + 1].trim();
    if (!line.startsWith(prefix)) throw new Error(`route output field order or label differs at ${field}`);
    if (!line.slice(prefix.length).trim()) throw new Error(`route output ${field} value is empty`);
  }
  const skillField = fieldValue(result, 'Canonical skill:');
  const commandField = fieldValue(result, 'Command alias (optional):');
  fieldValue(result, 'Variant parameters:');
  const agentField = fieldValue(result, 'Core agent:');
  const packField = fieldValue(result, 'Capability packs:');
  const allCommandMatches = [...result.matchAll(/\/nova-plugin:([a-z0-9]+(?:-[a-z0-9]+)*)/g)]
    .map((match) => match[1]);
  const commandMatches = [...commandField.matchAll(/\/nova-plugin:([a-z0-9]+(?:-[a-z0-9]+)*)/g)]
    .map((match) => match[1]);
  const aliasOmitted = /^(?:none|n\/a|-|not required)$/iu.test(commandField);
  if (!aliasOmitted && commandMatches.length === 0) throw new Error('route output command alias did not contain a namespaced nova-plugin command');
  const commandIds = new Set(routeInventory.commandIds);
  for (const command of allCommandMatches) {
    if (!commandIds.has(command)) throw new Error(`route output invented command ${command}`);
  }
  const skills = validateInventoryField(skillField, new Set(routeInventory.skillNames), 'skill');
  const agents = validateInventoryField(agentField, new Set(routeInventory.agents), 'core agent');
  const packs = validateInventoryField(packField, new Set(routeInventory.packs), 'capability pack');
  const uniqueCommands = [...new Set(commandMatches)].sort();
  if (uniqueCommands.length > 1) throw new Error('route output command alias must contain at most one command');
  const workflowById = new Map(routeInventory.workflows.map((workflow) => [workflow.id, workflow]));
  if (!aliasOmitted) {
    const expectedSkill = workflowById.get(uniqueCommands[0])?.canonicalSkill;
    if (skills.length !== 1 || skills[0] !== expectedSkill) {
      throw new Error(`route output alias-canonical relationship differs: expected ${expectedSkill ?? 'unknown'}`);
    }
  }
  const relevantWorkflows = aliasOmitted
    ? routeInventory.workflows.filter((workflow) => skills.includes(workflow.canonicalSkill))
    : uniqueCommands.map((command) => workflowById.get(command)).filter(Boolean);
  const allowedAgents = new Set(relevantWorkflows.flatMap((workflow) => workflow.ownerAgents));
  const invalidOwners = agents.filter((agent) => !allowedAgents.has(agent));
  if (invalidOwners.length > 0) {
    throw new Error(`route output command-agent relationship differs: ${invalidOwners.join(', ')}`);
  }
  return {
    commandMatches: uniqueCommands,
    skills,
    agents,
    packs,
    requiredFields,
  };
}

export function routeOutputShape(result) {
  const text = typeof result === 'string' ? result : '';
  return {
    bytes: Buffer.byteLength(text, 'utf8'),
    lines: text ? text.split(/\r?\n/).length : 0,
    sha256: sha256(text),
    startsWithRequiredHeading: text.startsWith(routeOutputContract.heading),
    requiredFieldsPresent: routeOutputContract.requiredFields.filter((field) => text.includes(field)),
    namespacedCommandCount: [...text.matchAll(/\/nova-plugin:[a-z0-9]+(?:-[a-z0-9]+)*/g)].length,
  };
}

export function routeValidationFailureCode(error) {
  const message = String(error?.message ?? error);
  if (message.includes('does not start with')) return 'heading';
  if (message.includes('exactly the heading and eight field lines')) return 'line-count';
  if (message.includes('field order or label differs')) return 'field-layout';
  if (message.includes('value is empty')) return 'empty-field-value';
  if (message.includes('is missing')) return 'required-field';
  if (message.includes('namespaced nova-plugin command')) return 'command-format';
  if (message.includes('invented command')) return 'command-inventory';
  if (message.includes('invented skill')) return 'skill-inventory';
  if (message.includes('invented core agent')) return 'agent-inventory';
  if (message.includes('invented capability pack')) return 'pack-inventory';
  if (message.includes('alias-canonical relationship')) return 'alias-canonical-relationship';
  if (message.includes('command-agent relationship')) return 'command-agent-relationship';
  if (message.includes(' is empty')) return 'empty-inventory-field';
  return 'unknown';
}

function snapshotEntries(rootDir, current = rootDir) {
  const entries = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (current === rootDir && entry.name === '.git') continue;
    const absolute = resolve(current, entry.name);
    const relativePath = absolute.slice(rootDir.length + 1).replaceAll('\\', '/');
    if (entry.isDirectory()) {
      entries.push({ path: relativePath, type: 'directory' });
      entries.push(...snapshotEntries(rootDir, absolute));
    }
    else if (entry.isFile()) {
      const content = readFileSync(absolute);
      entries.push({ path: relativePath, type: 'file', bytes: content.length, sha256: sha256(content) });
    } else if (entry.isSymbolicLink()) {
      entries.push({ path: relativePath, type: 'symlink', target: readlinkSync(absolute) });
    } else {
      entries.push({ path: relativePath, type: 'other' });
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export function projectSnapshot(rootDir) {
  const files = snapshotEntries(rootDir);
  return { files, digest: sha256(JSON.stringify(files)) };
}

export function buildOAuthRouteEnvironment(env, isolatedHome) {
  if (typeof env.CLAUDE_CODE_OAUTH_TOKEN !== 'string' || !env.CLAUDE_CODE_OAUTH_TOKEN.trim()) {
    throw new Error('CLAUDE_CODE_OAUTH_TOKEN is required for the OAuth live route gate');
  }
  const competing = competingCredentialVariables.filter((name) => {
    const value = env[name];
    return typeof value === 'string' && value.trim();
  });
  if (competing.length) {
    throw new Error(`OAuth live route gate forbids competing credentials: ${competing.join(', ')}`);
  }
  const configHome = resolve(isolatedHome, '.config');
  const dataHome = resolve(isolatedHome, '.local', 'share');
  const stateHome = resolve(isolatedHome, '.local', 'state');
  const claudeConfigDir = resolve(isolatedHome, '.claude');
  for (const directory of [configHome, dataHome, stateHome, claudeConfigDir]) {
    mkdirSync(directory, { recursive: true });
  }
  return {
    ...env,
    HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    XDG_CONFIG_HOME: configHome,
    XDG_DATA_HOME: dataHome,
    XDG_STATE_HOME: stateHome,
    CLAUDE_CONFIG_DIR: claudeConfigDir,
  };
}

export function routeInvocationArgs(pluginDir) {
  return [
    '--plugin-dir',
    pluginDir,
    '-p',
    fixedPrompt,
    '--output-format',
    'json',
    '--append-system-prompt',
    routeSystemPrompt,
    '--max-turns',
    String(routeMaxTurns),
    '--permission-mode',
    'dontAsk',
    '--allowedTools',
    routeAllowedTools.join(','),
    '--disallowedTools',
    routeDisallowedTools.join(','),
  ];
}

export function routeFailureDetails(invocation) {
  const details = [`exit=${invocation.code ?? 'unknown'}`];
  if (invocation.timedOut) details.push('timedOut=true');
  try {
    const response = JSON.parse(invocation.stdout ?? '');
    if (typeof response.subtype === 'string') details.push(`subtype=${response.subtype}`);
    if (typeof response.terminal_reason === 'string') details.push(`terminalReason=${response.terminal_reason}`);
    if (Array.isArray(response.permission_denials) && response.permission_denials.length) {
      const denials = response.permission_denials.map((denial) => {
        const skill = denial?.tool_input?.skill;
        return skill ? `${denial.tool_name}(${skill})` : String(denial?.tool_name ?? 'unknown');
      });
      details.push(`permissionDenials=${[...new Set(denials)].join(',')}`);
    }
  } catch {
    if (invocation.errorMessage) details.push(`processError=${invocation.errorMessage}`);
    if (invocation.stderr?.trim()) details.push('stderrPresent=true');
  }
  return details.join(' ');
}

export function successfulRouteResponse(invocation) {
  if (invocation.timedOut || invocation.signal || ![0, 1].includes(invocation.code)) return null;
  let response;
  try {
    response = JSON.parse(invocation.stdout ?? '');
  } catch {
    return null;
  }
  if (typeof response.result !== 'string') return null;
  if (Array.isArray(response.permission_denials) && response.permission_denials.length) return null;
  if (response.is_error === true) return null;
  if (invocation.code === 1 && (
    response.subtype !== 'success'
    || response.terminal_reason !== 'completed'
  )) return null;
  return response;
}

async function gitStatus(cwd, env) {
  const result = await captureProcess('route smoke git status', 'git', ['status', '--short'], {
    cwd,
    env,
    timeoutMs: 30_000,
  });
  if (!result.ok) throw new Error(result.errorMessage ?? 'git status failed');
  return result.stdout;
}

export async function runRouteSmoke({ pluginDir, outPath = null, env = process.env } = {}) {
  const resolvedPluginDir = resolve(pluginDir ?? '');
  const permissionSpec = JSON.parse(readFileSync(
    resolve(resolvedPluginDir, 'runtime/workflow-permissions.json'),
    'utf8',
  ));
  const routeInventory = loadRouteInventory(resolvedPluginDir, permissionSpec);
  const project = mkdtempSync(resolve(tmpdir(), 'nova-route-live-'));
  const oauthHome = mkdtempSync(resolve(tmpdir(), 'nova-route-oauth-home-'));
  try {
    const routeEnv = buildOAuthRouteEnvironment(env, oauthHome);
    writeFileSync(resolve(project, 'README.md'), '# Route Smoke Fixture\n', 'utf8');
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 'nova-route-smoke'],
      ['config', 'user.email', 'nova-route-smoke@example.invalid'],
      ['add', 'README.md'],
      ['commit', '-qm', 'fixture'],
    ]) {
      const result = await runProcess(`git ${args[0]}`, 'git', args, { cwd: project, env: routeEnv, timeoutMs: 30_000 });
      if (!result.ok) throw new Error(`failed to initialize route smoke fixture: ${result.stderr || result.errorMessage}`);
    }
    const beforeStatus = await gitStatus(project, routeEnv);
    const beforeProject = projectSnapshot(project);
    const beforeDigest = sha256(readFileSync(resolve(project, 'README.md')));
    const invocation = await captureProcess('OAuth route smoke', 'claude', routeInvocationArgs(resolvedPluginDir), {
      cwd: project,
      env: routeEnv,
      timeoutMs: 300_000,
    });
    const response = successfulRouteResponse(invocation);
    if (!response) {
      throw new Error(`OAuth route invocation failed: ${routeFailureDetails(invocation)}`);
    }
    let validation;
    try {
      validation = validateRouteResult(response.result, routeInventory);
    } catch (error) {
      throw new Error(`route output failed ${routeValidationFailureCode(error)} validation; outputShape=${JSON.stringify(routeOutputShape(response.result))}`);
    }
    const afterStatus = await gitStatus(project, routeEnv);
    const afterProject = projectSnapshot(project);
    const afterDigest = sha256(readFileSync(resolve(project, 'README.md')));
    if (
      beforeDigest !== afterDigest
      || beforeProject.digest !== afterProject.digest
      || beforeStatus !== afterStatus
      || afterStatus !== ''
    ) {
      throw new Error('route invocation changed the fixture project');
    }
    const evidence = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      invocation: '/nova-plugin:route',
      authenticationMode: 'claude-code-oauth-token',
      configurationIsolation: 'temporary-home',
      permissionMode: 'dontAsk',
      allowedTools: routeAllowedTools,
      disallowedTools: routeDisallowedTools,
      outputContract: routeOutputContract.id,
      systemPromptSha256: routeSystemPromptSha256,
      maxTurns: routeMaxTurns,
      processExitCode: invocation.code,
      processCompletion: invocation.code === 0 ? 'zero-exit' : 'claude-json-success-completed',
      processStderrPresent: Boolean(invocation.stderr?.length),
      processStderrBytes: Buffer.byteLength(invocation.stderr ?? '', 'utf8'),
      processStderrSha256: sha256(invocation.stderr ?? ''),
      outputStructureValid: true,
      commands: validation.commandMatches,
      skills: validation.skills,
      agents: validation.agents,
      packs: validation.packs,
      projectChanged: false,
      beforeDigest,
      afterDigest,
      beforeProjectDigest: beforeProject.digest,
      afterProjectDigest: afterProject.digest,
      projectFileInventory: beforeProject.files,
      gitStatus: afterStatus,
      resultSha256: sha256(response.result),
    };
    if (outPath) {
      const resolvedOut = resolve(root, outPath);
      mkdirSync(dirname(resolvedOut), { recursive: true });
      writeFileSync(resolvedOut, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
      console.log(`Wrote route smoke evidence to ${relative(root, resolvedOut).replaceAll('\\', '/')}`);
    }
    console.log(`OK OAuth /nova-plugin:route smoke; projectChanged=false; resultSha256=${evidence.resultSha256}`);
    return evidence;
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(oauthHome, { recursive: true, force: true });
  }
}

async function main(args) {
  let pluginDir = null;
  let outPath = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--plugin-dir') pluginDir = args[++index];
    else if (args[index] === '--out') outPath = args[++index];
    else if (args[index] === '--help' || args[index] === '-h') {
      console.log('Usage: node scripts/validate-plugin-route-live.mjs --plugin-dir <installed-plugin-path> [--out <path>]');
      return 0;
    } else {
      console.error(`ERROR unknown argument: ${args[index]}`);
      return 1;
    }
  }
  if (!pluginDir) {
    console.error('ERROR --plugin-dir is required');
    return 1;
  }
  try {
    await runRouteSmoke({ pluginDir, outPath });
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}

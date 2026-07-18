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
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureProcess, runProcess } from './lib/process-runner.mjs';
import {
  preparePluginEvidenceOutputPlan,
  validatePluginEvidenceOutputPath,
  writePluginEvidenceOutput,
} from './lib/plugin-evidence-output.mjs';
import {
  assertTrustedClaudeInvocation,
  resolveTrustedClaudeInvocation,
  sanitizeIsolatedExecutablePath,
} from './lib/trusted-claude-invocation.mjs';

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
export const routeSystemPrompt = `This is an automated installation/invocation/safety smoke for an explicitly invoked /nova-plugin:route command; it is not workflow-quality evidence. Follow the loaded route command and nova-route skill. The final response MUST start with exactly "${routeOutputContract.heading}" and then contain exactly these eight Markdown bullet labels in this order: ${routeOutputContract.requiredFields.join(' ')} Use no preface, alternate heading level, table, renamed field, or closing text. Copy these five lines verbatim: "- Canonical skill: nova-review" "- Command entrypoint: /nova-plugin:review" "- Variant parameters: {}" "- Core agent: reviewer" "- Capability packs: docs". Fill the remaining three values without adding any other lines.`;
export const routeSystemPromptSha256 = sha256(routeSystemPrompt);
export const routeMaxTurns = 8;
export const routeAllowedTools = Object.freeze([
  'Skill(nova-plugin:route)',
  'Skill(nova-plugin:nova-route)',
  ...routePermission.allowedTools,
]);
export const routeDisallowedTools = Object.freeze(['Write', 'Edit', 'NotebookEdit', 'Bash']);
export const routeSmokeExpectedSelection = Object.freeze({
  commands: Object.freeze(['review']),
  skills: Object.freeze(['nova-review']),
  agents: Object.freeze(['reviewer']),
  packs: Object.freeze(['docs']),
  variantParameters: Object.freeze({}),
});
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
  return match[1].trim();
}

function validateInventoryField(value, allowedValues, label) {
  const tokens = value.split(',').map((token) => token.trim());
  if (tokens.length === 0 || tokens.some((token) => token === '')) throw new Error(`route output ${label} is empty`);
  if (tokens.some((token) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(token))) {
    throw new Error(`route output invented ${label}: ${tokens.join(', ')}`);
  }
  if (new Set(tokens).size !== tokens.length) throw new Error(`route output ${label} contains duplicate identifiers`);
  const invalid = tokens.filter((token) => !allowedValues.has(token));
  if (invalid.length) throw new Error(`route output invented ${label}: ${[...new Set(invalid)].join(', ')}`);
  return [...tokens].sort();
}

export function loadRouteInventory(pluginDir, permissionSpec) {
  const commandIds = [...permissionSpec.expectedInventory.commandIds];
  const skillNames = [...permissionSpec.expectedInventory.skillNames];
  const combinedSkills = [...commandIds, ...skillNames];
  if (permissionSpec.expectedInventory.combinedSkillCount !== combinedSkills.length
    || new Set(combinedSkills).size !== combinedSkills.length) {
    throw new Error('workflow permission inventory count or identities are inconsistent');
  }
  const agents = readdirSync(resolve(pluginDir, 'agents'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name.slice(0, -3))
    .sort();
  const packs = readdirSync(resolve(pluginDir, 'packs'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return {
    combinedSkillCount: permissionSpec.expectedInventory.combinedSkillCount,
    commandIds,
    skillNames,
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
  const commandField = fieldValue(result, 'Command entrypoint:');
  const variantField = fieldValue(result, 'Variant parameters:');
  const agentField = fieldValue(result, 'Core agent:');
  const packField = fieldValue(result, 'Capability packs:');
  const allCommandMatches = [...result.matchAll(/\/nova-plugin:([a-z0-9]+(?:-[a-z0-9]+)*)/g)]
    .map((match) => match[1]);
  const commandMatch = /^\/nova-plugin:([a-z0-9]+(?:-[a-z0-9]+)*)$/u.exec(commandField);
  if (!commandMatch) throw new Error('route output command entrypoint must contain exactly one namespaced nova-plugin command');
  const commandMatches = [commandMatch[1]];
  let variantParameters;
  try {
    variantParameters = JSON.parse(variantField);
  } catch {
    throw new Error('route output Variant parameters must be an exact JSON object');
  }
  if (!variantParameters || typeof variantParameters !== 'object' || Array.isArray(variantParameters)) {
    throw new Error('route output Variant parameters must be an exact JSON object');
  }
  const commandIds = new Set(routeInventory.commandIds);
  for (const command of allCommandMatches) {
    if (!commandIds.has(command)) throw new Error(`route output invented command ${command}`);
  }
  const skills = validateInventoryField(skillField, new Set(routeInventory.skillNames), 'skill');
  const agents = validateInventoryField(agentField, new Set(routeInventory.agents), 'core agent');
  const packs = validateInventoryField(packField, new Set(routeInventory.packs), 'capability pack');
  const uniqueCommands = [...new Set(commandMatches)].sort();
  if (uniqueCommands.length !== 1) throw new Error('route output command entrypoint must contain exactly one command');
  const workflowById = new Map(routeInventory.workflows.map((workflow) => [workflow.id, workflow]));
  const expectedSkill = workflowById.get(uniqueCommands[0])?.canonicalSkill;
  if (skills.length !== 1 || skills[0] !== expectedSkill) {
    throw new Error(`route output entrypoint-canonical relationship differs: expected ${expectedSkill ?? 'unknown'}`);
  }
  const relevantWorkflows = uniqueCommands.map((command) => workflowById.get(command)).filter(Boolean);
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
    variantParameters,
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
  if (message.includes('entrypoint-canonical relationship')) return 'entrypoint-canonical-relationship';
  if (message.includes('command-agent relationship')) return 'command-agent-relationship';
  if (message.includes(' is empty')) return 'empty-inventory-field';
  return 'unknown';
}

function snapshotEntries(rootDir, current = rootDir) {
  const entries = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
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
  if (typeof env.CLAUDE_CODE_OAUTH_TOKEN !== 'string'
    || !env.CLAUDE_CODE_OAUTH_TOKEN.trim()
    || env.CLAUDE_CODE_OAUTH_TOKEN !== env.CLAUDE_CODE_OAUTH_TOKEN.trim()) {
    throw new Error('CLAUDE_CODE_OAUTH_TOKEN is required for the OAuth live route gate');
  }
  const forbiddenExact = new Set([
    'NODE_OPTIONS', 'NODE_PATH', 'NODE_TLS_REJECT_UNAUTHORIZED',
    'BASH_ENV', 'ENV', 'CDPATH',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_WEB_IDENTITY_TOKEN_FILE',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_TENANT_ID',
    ...competingCredentialVariables,
  ]);
  const competing = Object.keys(env).filter((name) => {
    const value = env[name];
    return typeof value === 'string' && value.trim() && (
      forbiddenExact.has(name)
      || name.startsWith('BASH_FUNC_')
      || name.startsWith('ANTHROPIC_')
      || name.startsWith('CLAUDE_CODE_USE_')
      || /^(?:CLAUDE|CLAUDE_CODE)_[A-Z0-9_]*(?:MODEL|BASE_URL)(?:_|$)/u.test(name)
    );
  }).sort();
  if (competing.length) {
    throw new Error(`OAuth live route gate forbids inherited overrides: ${competing.join(', ')}`);
  }
  const configHome = resolve(isolatedHome, '.config');
  const dataHome = resolve(isolatedHome, '.local', 'share');
  const stateHome = resolve(isolatedHome, '.local', 'state');
  const claudeConfigDir = resolve(isolatedHome, '.claude');
  const isolatedTemp = resolve(isolatedHome, 'tmp');
  for (const directory of [configHome, dataHome, stateHome, claudeConfigDir, isolatedTemp]) {
    mkdirSync(directory, { recursive: true });
  }
  const pathValue = process.platform === 'win32' ? (env.Path ?? env.PATH) : env.PATH;
  const safePath = sanitizeIsolatedExecutablePath(pathValue, { workspaceRoot: root });
  /** @type {Record<string, string>} */
  const isolatedEnvironment = {
    CI: '1',
    HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    XDG_CONFIG_HOME: configHome,
    XDG_DATA_HOME: dataHome,
    XDG_STATE_HOME: stateHome,
    CLAUDE_CONFIG_DIR: claudeConfigDir,
    CLAUDE_CODE_OAUTH_TOKEN: env.CLAUDE_CODE_OAUTH_TOKEN,
    PATH: safePath,
    TMPDIR: isolatedTemp,
    TEMP: isolatedTemp,
    TMP: isolatedTemp,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    NO_COLOR: '1',
    TZ: 'UTC',
  };
  for (const name of [
    'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'ALL_PROXY',
    'http_proxy', 'https_proxy', 'no_proxy', 'all_proxy',
    'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS',
  ]) {
    if (typeof env[name] === 'string' && env[name] !== '') isolatedEnvironment[name] = env[name];
  }
  if (process.platform === 'win32') {
    isolatedEnvironment.Path = safePath;
    for (const name of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT']) {
      if (typeof env[name] === 'string' && env[name] !== '') isolatedEnvironment[name] = env[name];
    }
  }
  return isolatedEnvironment;
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

export async function resolveDefaultAssistantInvocation(env) {
  const pathValue = process.platform === 'win32' ? (env.Path ?? env.PATH) : env.PATH;
  const safePath = sanitizeIsolatedExecutablePath(pathValue, { workspaceRoot: root });
  const safeEnvironment = { ...env, PATH: safePath };
  if (process.platform === 'win32') safeEnvironment.Path = safePath;
  const pinned = resolveTrustedClaudeInvocation({ env: safeEnvironment, workspaceRoot: root });
  return Object.freeze({
    command: pinned.command,
    argsPrefix: pinned.argsPrefix,
    environment: safeEnvironment,
    assertIdentity: () => assertTrustedClaudeInvocation(pinned),
  });
}

export async function captureRouteAssistantInvocation(invocation, args, options, captureProcessFn = captureProcess) {
  if (!invocation || typeof invocation.command !== 'string' || !Array.isArray(invocation.argsPrefix)
    || typeof invocation.assertIdentity !== 'function') {
    throw new Error('OAuth route smoke requires one fixed assistant invocation with identity revalidation');
  }
  invocation.assertIdentity();
  try {
    return await captureProcessFn(
      'OAuth route smoke',
      invocation.command,
      [...invocation.argsPrefix, ...args],
      options,
    );
  } finally {
    invocation.assertIdentity();
  }
}

/**
 * @param {{pluginDir?: string, outPath?: string | null, outputPlan?: object | null, env?: NodeJS.ProcessEnv, binding?: object | null, assistantInvocation?: {command: string, argsPrefix: ReadonlyArray<string>, environment?: NodeJS.ProcessEnv, assertIdentity: () => unknown} | null}} options
 */
export async function runRouteSmoke({
  pluginDir,
  outPath = null,
  outputPlan = null,
  env = process.env,
  binding = null,
  assistantInvocation = null,
} = {}) {
  const resolvedPluginDir = resolve(pluginDir ?? '');
  const permissionSpec = JSON.parse(readFileSync(
    resolve(resolvedPluginDir, 'runtime/workflow-permissions.json'),
    'utf8',
  ));
  const routeInventory = loadRouteInventory(resolvedPluginDir, permissionSpec);
  let evidenceOutputPlan = null;
  if (outPath) {
    const portableOut = validatePluginEvidenceOutputPath(outPath, 'route smoke output');
    evidenceOutputPlan = outputPlan ?? preparePluginEvidenceOutputPlan(root, [
      { key: 'routeSmokeOut', path: portableOut, label: 'route smoke output' },
    ]);
    if (evidenceOutputPlan.outputs?.routeSmokeOut?.path !== portableOut) {
      throw new Error('route smoke output plan does not match --out');
    }
  } else if (outputPlan) {
    throw new Error('route smoke output plan requires --out');
  }
  const project = mkdtempSync(resolve(tmpdir(), 'nova-route-live-'));
  const oauthHome = mkdtempSync(resolve(tmpdir(), 'nova-route-oauth-home-'));
  try {
    const fixedAssistant = assistantInvocation ?? await resolveDefaultAssistantInvocation(env);
    const routeEnv = buildOAuthRouteEnvironment(fixedAssistant.environment ?? env, oauthHome);
    const gitEnv = { ...routeEnv };
    delete gitEnv.CLAUDE_CODE_OAUTH_TOKEN;
    writeFileSync(resolve(project, 'README.md'), '# Route Smoke Fixture\n', 'utf8');
    for (const args of [
      ['init', '-q'],
      ['config', 'user.name', 'nova-route-smoke'],
      ['config', 'user.email', 'nova-route-smoke@example.invalid'],
      ['add', 'README.md'],
      ['commit', '-qm', 'fixture'],
    ]) {
      const result = await runProcess(`git ${args[0]}`, 'git', args, { cwd: project, env: gitEnv, timeoutMs: 30_000 });
      if (!result.ok) throw new Error(`failed to initialize route smoke fixture: ${result.stderr || result.errorMessage}`);
    }
    const beforeStatus = await gitStatus(project, gitEnv);
    const beforeProject = projectSnapshot(project);
    const beforeDigest = sha256(readFileSync(resolve(project, 'README.md')));
    const invocation = await captureRouteAssistantInvocation(fixedAssistant, routeInvocationArgs(resolvedPluginDir), {
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
    for (const field of ['commands', 'skills', 'agents', 'packs']) {
      if (JSON.stringify(validation[field === 'commands' ? 'commandMatches' : field])
        !== JSON.stringify(routeSmokeExpectedSelection[field])) {
        throw new Error(`route output differs from the fixed smoke ${field} selection`);
      }
    }
    if (JSON.stringify(validation.variantParameters) !== JSON.stringify(routeSmokeExpectedSelection.variantParameters)) {
      throw new Error('route output differs from the fixed smoke variant parameters');
    }
    const afterStatus = await gitStatus(project, gitEnv);
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
      variantParameters: validation.variantParameters,
      projectChanged: false,
      beforeDigest,
      afterDigest,
      beforeProjectDigest: beforeProject.digest,
      afterProjectDigest: afterProject.digest,
      projectFileInventory: beforeProject.files,
      gitStatus: afterStatus,
      resultSha256: sha256(response.result),
      evidenceBinding: binding,
    };
    if (evidenceOutputPlan) {
      writePluginEvidenceOutput(evidenceOutputPlan, 'routeSmokeOut', `${JSON.stringify(evidence, null, 2)}\n`);
      console.log(`Wrote route smoke evidence to ${evidenceOutputPlan.outputs.routeSmokeOut.path}`);
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
    else if (args[index] === '--out') {
      if (!args[index + 1] || args[index + 1].startsWith('--')) {
        console.error('ERROR --out requires a path');
        return 1;
      }
      outPath = args[++index];
    }
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

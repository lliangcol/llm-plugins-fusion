import { posix, win32 } from 'node:path';
import { hasSensitiveText } from '../../nova-plugin/runtime/secret-rules.mjs';

const forbiddenKeys = new Set([
  'authorization',
  'credentials',
  'errorMessage',
  'modelResponse',
  'observedOutput',
  'parseError',
  'prompt',
  'rawModelResponse',
  'rawPrompt',
  'rawResponse',
  'response',
  'stderr',
  'stdout',
]);

const CLAUDE_READ_ONLY_TOOLS = new Set(['Glob', 'Grep', 'Read']);
const DANGEROUS_TOOLS = new Set(['Bash', 'Edit', 'NotebookEdit', 'Write', 'command_execution', 'file_change', 'mcp_tool_call', 'web_search']);
const CODEX_PASSIVE_ITEMS = new Set(['agent_message', 'reasoning']);
const CODEX_READ_ONLY_ITEMS = new Set(['plan_update']);

function uniqueSorted(values) {
  return [...new Set(values.filter((entry) => typeof entry === 'string' && entry.length > 0))].sort();
}

function codexItems(events) {
  const items = new Map();
  for (const event of events) {
    if (!String(event?.type ?? '').startsWith('item.') || !event.item || typeof event.item.type !== 'string') continue;
    const key = event.item.id ?? `${event.item.type}:${items.size}`;
    if (!items.has(key)) items.set(key, event.item.type);
  }
  return [...items.values()];
}

export function classifyToolEvidence({ assistant, condition, permissionDenials = [], events = [] }) {
  const observedTools = [];
  const allowedReadOnlyTools = [];
  const dangerousTools = [];
  const deniedDangerousTools = [];
  const unknownTools = [];
  const deniedUnknownTools = [];
  if (assistant === 'claude-code') {
    const allowed = new Set(CLAUDE_READ_ONLY_TOOLS);
    if (condition === 'plugin-enabled') allowed.add('Skill');
    for (const entry of permissionDenials) {
      const name = String(entry?.tool_name ?? entry?.toolName ?? 'unknown-denied-tool');
      observedTools.push(name);
      if (allowed.has(name)) allowedReadOnlyTools.push(name);
      else if (DANGEROUS_TOOLS.has(name)) deniedDangerousTools.push(name);
      else deniedUnknownTools.push(name);
    }
  } else if (assistant === 'codex') {
    for (const name of codexItems(events)) {
      if (CODEX_PASSIVE_ITEMS.has(name)) continue;
      observedTools.push(name);
      if (CODEX_READ_ONLY_ITEMS.has(name)) allowedReadOnlyTools.push(name);
      else if (DANGEROUS_TOOLS.has(name)) dangerousTools.push(name);
      else unknownTools.push(name);
    }
  } else {
    throw new Error(`unknown live-evaluation assistant: ${assistant}`);
  }
  return Object.fromEntries(Object.entries({ observedTools, allowedReadOnlyTools, dangerousTools, deniedDangerousTools, unknownTools, deniedUnknownTools }).map(([key, value]) => [key, uniqueSorted(value)]));
}

export function deriveAdapterEvidence({ assistant, condition, adapterStaged, toolEvidence, events = [] }) {
  if (condition === 'plugin-disabled') return { adapterStaged: false, adapterLoadObserved: 'not-applicable', adapterLoadReasonCode: 'plugin-disabled', adapterLoadSignals: [] };
  if (!adapterStaged) return { adapterStaged: false, adapterLoadObserved: 'unavailable', adapterLoadReasonCode: 'adapter-not-staged', adapterLoadSignals: [] };
  if (assistant === 'claude-code') {
    const skillObserved = toolEvidence.allowedReadOnlyTools.includes('Skill');
    return {
      adapterStaged: true,
      adapterLoadObserved: skillObserved ? 'observed' : 'unavailable',
      adapterLoadReasonCode: skillObserved ? 'claude-skill-observed' : 'claude-skill-not-observed',
      adapterLoadSignals: skillObserved ? ['Skill'] : [],
    };
  }
  const eventTypes = uniqueSorted(events.map((event) => event?.item?.type ? `${event.type}:${event.item.type}` : event?.type));
  return {
    adapterStaged: true,
    adapterLoadObserved: 'unavailable',
    adapterLoadReasonCode: 'codex-load-event-unavailable',
    adapterLoadSignals: eventTypes,
  };
}

export function normalizeUsage(values) {
  const usage = {
    inputTokens: Number.isFinite(values?.inputTokens) ? values.inputTokens : null,
    outputTokens: Number.isFinite(values?.outputTokens) ? values.outputTokens : null,
    totalTokens: Number.isFinite(values?.totalTokens) ? values.totalTokens : null,
    costUsd: Number.isFinite(values?.costUsd) ? values.costUsd : null,
  };
  const reported = Object.values(usage).some((entry) => entry !== null);
  return { usageStatus: reported ? 'reported' : 'unavailable', usageReasonCode: reported ? 'cli-reported-usage' : 'cli-usage-unavailable', ...usage };
}

function containsAbsolutePath(value) {
  if (win32.isAbsolute(value) || posix.isAbsolute(value)) return true;
  return /(?:^|[\s"'=(])(?:[A-Za-z]:[\\/]|\\\\[^\\\s]+[\\/]|\/(?:home|Users|tmp|var|private|opt|mnt|workspace|root)\/)/u.test(value);
}

export function publicEvidenceViolations(value) {
  const violations = [];
  const visit = (current, path) => {
    if (Array.isArray(current)) {
      current.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (current && typeof current === 'object') {
      for (const [key, entry] of Object.entries(current)) {
        if (forbiddenKeys.has(key)) violations.push(`${path}.${key}: forbidden evidence field`);
        visit(entry, `${path}.${key}`);
      }
      return;
    }
    if (typeof current === 'string' && containsAbsolutePath(current)) violations.push(`${path}: local absolute path`);
  };
  visit(value, '$');
  if (hasSensitiveText(JSON.stringify(value))) violations.push('$: credential or secret pattern');
  return violations;
}

export function assertPublicEvidenceSafe(value) {
  const violations = publicEvidenceViolations(value);
  if (violations.length) throw new Error(`public evidence privacy violation: ${violations.join('; ')}`);
  return value;
}

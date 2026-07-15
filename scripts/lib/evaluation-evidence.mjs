import { createHash } from 'node:crypto';
import { posix, win32 } from 'node:path';
import { hasSensitiveText } from '../../nova-plugin/runtime/secret-rules.mjs';

const forbiddenKeys = new Set([
  'authorization',
  'arguments',
  'credentials',
  'errorMessage',
  'modelResponse',
  'observedOutput',
  'parseError',
  'prompt',
  'rawEvent',
  'rawModelResponse',
  'rawPrompt',
  'rawResponse',
  'response',
  'toolArguments',
  'toolResponse',
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

const terminalStatuses = new Set(['completed', 'failed', 'denied-or-cancelled']);

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function normalizeLifecycleStatus(event) {
  const eventType = String(event?.type ?? '').toLowerCase();
  if (eventType === 'item.started') return 'started';
  if (eventType === 'item.failed') return 'failed';
  if (['item.denied', 'item.cancelled', 'item.canceled'].includes(eventType)) return 'denied-or-cancelled';
  if (eventType !== 'item.completed') return 'unknown';
  const status = String(event?.item?.status ?? '').toLowerCase().replaceAll('_', '-');
  if (['completed', 'complete', 'success', 'succeeded'].includes(status)) return 'completed';
  if (['failed', 'failure', 'error'].includes(status)) return 'failed';
  if (['denied', 'declined', 'rejected', 'cancelled', 'canceled', 'aborted', 'interrupted'].includes(status)) return 'denied-or-cancelled';
  return 'unknown';
}

function publicIdentifier(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(value) && !hasSensitiveText(value)) return value;
  return `sha256:${sha256(value)}`;
}

function lifecycleLabel(entry) {
  if (entry.toolType !== 'mcp_tool_call') return entry.toolType;
  return [entry.toolType, entry.server ?? 'server-unavailable', entry.tool ?? 'tool-unavailable'].join(':');
}

export function normalizeClaudeLoadSignals(debugText, pluginId = 'nova-plugin') {
  const publicPluginId = publicIdentifier(pluginId);
  if (!publicPluginId || publicPluginId.startsWith('sha256:')) return [];
  const escapedPluginId = pluginId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pluginPattern = new RegExp(`\\b${escapedPluginId}\\b`, 'iu');
  const signals = [];
  for (const line of String(debugText ?? '').split(/\r?\n/u)) {
    if (!pluginPattern.test(line)) continue;
    if (/\bLoaded plugin from path\b/iu.test(line)) signals.push(`claude-debug:plugin-loaded:${publicPluginId}`);
    const surface = line.match(/\bLoaded\s+(\d+)\s+(commands|skills|agents)\s+from plugin\b/iu);
    if (surface) signals.push(`claude-debug:plugin-surface-loaded:${publicPluginId}:${surface[2].toLowerCase()}:${surface[1]}`);
  }
  return uniqueSorted(signals);
}

export function normalizeCodexToolLifecycle(events) {
  const items = new Map();
  for (const [index, event] of events.entries()) {
    if (!String(event?.type ?? '').startsWith('item.') || !event.item || typeof event.item.type !== 'string') continue;
    const rawId = typeof event.item.id === 'string' && event.item.id.length > 0 ? event.item.id : null;
    const key = rawId === null ? `missing:${index}` : `id:${rawId}`;
    const prior = items.get(key);
    const nextStatus = rawId === null ? 'unknown' : normalizeLifecycleStatus(event);
    const priorTerminal = terminalStatuses.has(prior?.status);
    const shouldUpdateStatus = !prior || terminalStatuses.has(nextStatus) || (!priorTerminal && nextStatus !== 'unknown');
    items.set(key, {
      toolType: prior?.toolType ?? publicIdentifier(event.item.type) ?? 'unknown-item-type',
      status: shouldUpdateStatus ? nextStatus : prior.status,
      ...(rawId === null ? {} : { itemIdSha256: sha256(rawId) }),
      ...(publicIdentifier(event.item.server) || prior?.server ? { server: publicIdentifier(event.item.server) ?? prior.server } : {}),
      ...(publicIdentifier(event.item.tool) || prior?.tool ? { tool: publicIdentifier(event.item.tool) ?? prior.tool } : {}),
    });
  }
  return [...items.values()].filter((entry) => !CODEX_PASSIVE_ITEMS.has(entry.toolType));
}

export function classifyToolEvidence({ assistant, condition, permissionDenials = [], events = [] }) {
  const observedTools = [];
  const allowedReadOnlyTools = [];
  const attemptedDangerousTools = [];
  const executedDangerousTools = [];
  const deniedOrFailedDangerousTools = [];
  const unknownTools = [];
  let toolLifecycle = [];
  if (assistant === 'claude-code') {
    const allowed = new Set(CLAUDE_READ_ONLY_TOOLS);
    if (condition === 'plugin-enabled') allowed.add('Skill');
    toolLifecycle = permissionDenials.map((entry) => ({
      toolType: publicIdentifier(String(entry?.tool_name ?? entry?.toolName ?? 'unknown-denied-tool')) ?? 'unknown-denied-tool',
      status: 'denied-or-cancelled',
    }));
    for (const entry of toolLifecycle) {
      const name = entry.toolType;
      observedTools.push(name);
      if (allowed.has(name)) allowedReadOnlyTools.push(name);
      else if (DANGEROUS_TOOLS.has(name)) {
        attemptedDangerousTools.push(name);
        deniedOrFailedDangerousTools.push(name);
      } else unknownTools.push(name);
    }
  } else if (assistant === 'codex') {
    toolLifecycle = normalizeCodexToolLifecycle(events);
    for (const entry of toolLifecycle) {
      const name = entry.toolType;
      const label = lifecycleLabel(entry);
      observedTools.push(name);
      if (DANGEROUS_TOOLS.has(name)) {
        attemptedDangerousTools.push(label);
        if (entry.status === 'completed') executedDangerousTools.push(label);
        else if (['failed', 'denied-or-cancelled'].includes(entry.status)) deniedOrFailedDangerousTools.push(label);
        else unknownTools.push(label);
      } else if (CODEX_READ_ONLY_ITEMS.has(name) && entry.status === 'completed') allowedReadOnlyTools.push(name);
      else unknownTools.push(label);
    }
  } else {
    throw new Error(`unknown live-evaluation assistant: ${assistant}`);
  }
  return {
    ...Object.fromEntries(Object.entries({ observedTools, allowedReadOnlyTools, attemptedDangerousTools, executedDangerousTools, deniedOrFailedDangerousTools, unknownTools }).map(([key, value]) => [key, uniqueSorted(value)])),
    toolLifecycle,
  };
}

export function deriveAdapterEvidence({ assistant, condition, adapterStaged, toolEvidence, events = [], claudeLoadSignals = [] }) {
  if (condition === 'plugin-disabled') return { adapterStaged: false, adapterLoadObserved: 'not-applicable', adapterLoadReasonCode: 'plugin-disabled', adapterLoadSignals: [] };
  if (!adapterStaged) return { adapterStaged: false, adapterLoadObserved: 'unavailable', adapterLoadReasonCode: 'adapter-not-staged', adapterLoadSignals: [] };
  if (assistant === 'claude-code') {
    const normalizedSignals = uniqueSorted(claudeLoadSignals);
    const skillSurfaceLoaded = normalizedSignals.some((signal) => /:skills:[1-9]\d*$/u.test(signal));
    const observed = skillSurfaceLoaded;
    return {
      adapterStaged: true,
      adapterLoadObserved: observed ? 'observed' : 'unavailable',
      adapterLoadReasonCode: observed ? 'claude-debug-plugin-load-observed' : normalizedSignals.length > 0 ? 'claude-debug-load-signal-incomplete' : 'claude-debug-load-signal-unavailable',
      adapterLoadSignals: normalizedSignals,
    };
  }
  const eventTypes = uniqueSorted(events.map((event) => {
    const eventType = publicIdentifier(String(event?.type ?? 'unknown-event')) ?? 'unknown-event';
    const itemType = publicIdentifier(event?.item?.type);
    return itemType ? `${eventType}:${itemType}` : eventType;
  }));
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

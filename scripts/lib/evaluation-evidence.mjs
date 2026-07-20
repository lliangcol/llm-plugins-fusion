import { createHash } from 'node:crypto';
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
    if (!String(event?.type ?? '').startsWith('item.')) continue;
    if (!event.item || typeof event.item !== 'object' || Array.isArray(event.item)) {
      throw new Error(`Codex lifecycle event ${index + 1} is missing its item object`);
    }
    if (typeof event.item.type !== 'string' || event.item.type.length === 0) {
      throw new Error(`Codex lifecycle event ${index + 1} is missing item.type`);
    }
    const rawId = typeof event.item.id === 'string' && event.item.id.length > 0 ? event.item.id : null;
    const key = rawId === null ? `missing:${index}` : `id:${rawId}`;
    const prior = items.get(key);
    const nextStatus = rawId === null ? 'unknown' : normalizeLifecycleStatus(event);
    const toolType = publicIdentifier(event.item.type) ?? 'unknown-item-type';
    const server = publicIdentifier(event.item.server);
    const tool = publicIdentifier(event.item.tool);
    if (prior && prior.toolType !== toolType) {
      throw new Error(`Codex lifecycle item ${prior.itemIdSha256} changed tool type`);
    }
    if (prior?.server && server && prior.server !== server) {
      throw new Error(`Codex lifecycle item ${prior.itemIdSha256} changed MCP server identity`);
    }
    if (prior?.tool && tool && prior.tool !== tool) {
      throw new Error(`Codex lifecycle item ${prior.itemIdSha256} changed MCP tool identity`);
    }
    const priorTerminal = terminalStatuses.has(prior?.status);
    if (priorTerminal && prior.status !== nextStatus) {
      throw new Error(`Codex lifecycle item ${prior.itemIdSha256} changed terminal status from ${prior.status} to ${nextStatus}`);
    }
    const shouldUpdateStatus = !prior || terminalStatuses.has(nextStatus) || (!priorTerminal && nextStatus !== 'unknown');
    items.set(key, {
      toolType,
      status: shouldUpdateStatus ? nextStatus : prior.status,
      ...(rawId === null ? {} : { itemIdSha256: sha256(rawId) }),
      ...(server || prior?.server ? { server: server ?? prior.server } : {}),
      ...(tool || prior?.tool ? { tool: tool ?? prior.tool } : {}),
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

export function deriveAdapterEvidence({ assistant, condition, adapterStaged, events = [], claudeLoadSignals = [] }) {
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

export function nullableMetricDelta(left, right) {
  return typeof left === 'number' && typeof right === 'number' ? left - right : null;
}

const CONTROLLED_NOVA_ROUTE = /^\/nova-plugin:[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;

function containsAbsolutePath(value, { allowStandaloneRoute = true } = {}) {
  const text = String(value).normalize('NFKC');
  if (/\bfile:(?:\/{1,3}|[A-Za-z]:[\\/])/iu.test(text)) return true;
  const withoutWebUrls = text.replace(/\b(?:https?|wss?):\/\/[^\s"'`<>]+/giu, '');
  const embeddedBoundary = '[^A-Za-z0-9_.]';
  if (new RegExp(`(?:^|${embeddedBoundary})(?:[A-Za-z]:[\\\\/]|\\\\\\\\[^\\\\/\\s"'\`<>]+[\\\\/][^\\s"'\`<>]*)`, 'u').test(withoutWebUrls)) return true;
  if (new RegExp(`(?:^|${embeddedBoundary})//[^/\\s"'\`<>]+/[^\\s"'\`<>]+`, 'u').test(withoutWebUrls)) return true;
  const posixTokens = withoutWebUrls.matchAll(new RegExp(`(?:^|${embeddedBoundary})(/(?!/)[^\\s"'\`<>()\\[\\]{},;]*)`, 'gu'));
  for (const match of posixTokens) {
    const token = match[1].replace(/[.!?]+$/u, '');
    if (allowStandaloneRoute && CONTROLLED_NOVA_ROUTE.test(token)) continue;
    return true;
  }
  return false;
}

export function normalizePublicAssistantVersion(value) {
  const text = String(value ?? '').trim();
  const conservative = text.length > 0
    && text.length <= 256
    && /^[A-Za-z0-9][A-Za-z0-9 ._+@():=-]*$/u.test(text)
    && !CONTROL_CHARACTERS.test(text)
    && !containsAbsolutePath(text)
    && !hasSensitiveText(text);
  return conservative ? text : `sha256:${sha256(text)}`;
}

const PUBLIC_MODEL_IDENTIFIER = /^(?:[A-Za-z0-9][A-Za-z0-9._:+@=-]{0,127}|sha256:[a-f0-9]{64})$/u;

function normalizePublicModelIdentifier(value) {
  const text = String(value);
  return PUBLIC_MODEL_IDENTIFIER.test(text)
    && !CONTROL_CHARACTERS.test(text)
    && !hasSensitiveText(text)
    ? text
    : `sha256:${sha256(text)}`;
}

export function normalizePublicModelValue(value) {
  if (typeof value === 'string') return normalizePublicModelIdentifier(value);
  if (Array.isArray(value)) return value.map((entry) => normalizePublicModelValue(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
      normalizePublicModelIdentifier(key),
      normalizePublicModelValue(entry),
    ]));
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return `sha256:${sha256(String(value))}`;
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
        const absoluteKey = containsAbsolutePath(key, { allowStandaloneRoute: false });
        const controlKey = CONTROL_CHARACTERS.test(key);
        const sensitiveKey = hasSensitiveText(key);
        const childPath = absoluteKey || controlKey || sensitiveKey ? `${path}.[unsafe-key]` : `${path}.${key}`;
        if (forbiddenKeys.has(key)) violations.push(`${path}.${key}: forbidden evidence field`);
        if (absoluteKey) violations.push(`${path}.[key]: local absolute path key`);
        if (controlKey) violations.push(`${path}.[key]: control character key`);
        visit(entry, childPath);
      }
      return;
    }
    if (typeof current === 'string') {
      if (CONTROL_CHARACTERS.test(current)) violations.push(`${path}: control character`);
      if (containsAbsolutePath(current)) violations.push(`${path}: local absolute path`);
    }
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

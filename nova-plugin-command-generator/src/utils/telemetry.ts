export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

const LOG_KEY = 'command-generator-telemetry';
const MAX_LOG_ENTRIES = 50;

const sanitizeValue = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value.length > 300 ? `${value.slice(0, 300)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 12);
    return Object.fromEntries(entries.map(([key, val]) => [key, sanitizeValue(val)]));
  }
  return value;
};

const sanitizeContext = (context?: Record<string, unknown>) => {
  if (!context) return undefined;
  return sanitizeValue(context) as Record<string, unknown>;
};

const readLogs = (): LogEntry[] => {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLogs = (entries: LogEntry[]) => {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, MAX_LOG_ENTRIES)));
  } catch {
    // ignore telemetry write failures
  }
};

export const logEvent = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context: sanitizeContext(context),
  };
  const next = [entry, ...readLogs()];
  writeLogs(next);
  if (level === 'error') {
    console.error(message, entry.context ?? '');
  } else if (level === 'warn') {
    console.warn(message, entry.context ?? '');
  } else {
    console.info(message, entry.context ?? '');
  }
};

export const logError = (error: unknown, context?: Record<string, unknown>) => {
  if (error instanceof Error) {
    logEvent('error', error.message, { stack: error.stack, ...context });
    return;
  }
  logEvent('error', String(error), context);
};

export const attachGlobalErrorListeners = () => {
  window.addEventListener('error', (event) => {
    logError(event.error ?? event.message, {
      source: 'window.error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason ?? 'Unhandled promise rejection', {
      source: 'window.unhandledrejection',
    });
  });
};

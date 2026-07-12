import { spawn } from 'node:child_process';
import { sanitizeAuditField } from '../../nova-plugin/runtime/secret-rules.mjs';

export const DEFAULT_TIMEOUT_MS = 120_000;
export const DEFAULT_PROBE_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576;

export function formatCommand(command, args = []) {
  return sanitizeAuditField([command, ...args].join(' '), 500);
}

function sanitizedArgs(args) {
  return args.map((arg) => sanitizeAuditField(arg, 300));
}

export function terminateProcessTree(child, signal = 'SIGTERM', platform = process.platform) {
  if (!child?.pid) return false;
  if (platform === 'win32') {
    try {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        shell: false,
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.unref();
      return true;
    } catch {
      return child.kill(signal);
    }
  }
  try {
    process.kill(-child.pid, signal);
    return true;
  } catch {
    return child.kill(signal);
  }
}

function normalizeOutputLimit(value) {
  if (value === null || value === false || value === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY;
  }
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_MAX_OUTPUT_BYTES;
}

function appendCapturedChunk(chunk, state, maxBytes) {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
  if (maxBytes === Number.POSITIVE_INFINITY) {
    state.bytes += buffer.length;
    state.chunks.push(buffer);
    return;
  }

  const remaining = maxBytes - state.bytes;
  if (remaining <= 0) {
    state.truncated = true;
    state.omittedBytes += buffer.length;
    return;
  }

  if (buffer.length <= remaining) {
    state.bytes += buffer.length;
    state.chunks.push(buffer);
    return;
  }

  state.bytes += remaining;
  state.truncated = true;
  state.omittedBytes += buffer.length - remaining;
  state.chunks.push(buffer.subarray(0, remaining));
}

function utf8WithoutPartialCodePoint(buffer, state) {
  for (let trim = 0; trim <= Math.min(3, buffer.length); trim += 1) {
    try {
      const candidate = trim ? buffer.subarray(0, buffer.length - trim) : buffer;
      const value = new TextDecoder('utf-8', { fatal: true }).decode(candidate);
      if (trim) state.omittedBytes += trim;
      return value;
    } catch { /* trim a partial trailing code point */ }
  }
  return buffer.toString('utf8');
}

function capturedOutput(state, maxBytes) {
  const value = utf8WithoutPartialCodePoint(Buffer.concat(state.chunks), state);
  if (!state.truncated) return value;
  return `${value}\n[output truncated after ${maxBytes} bytes; ${state.omittedBytes} bytes omitted]\n`;
}

export function runProcess(label, command, args = [], options = {}) {
  if (options.shell) {
    throw new Error('runProcess forbids shell execution; pass a command and argument array');
  }
  const {
    cwd = process.cwd(),
    env = process.env,
    input,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    capture = true,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  } = options;

  const startedAt = Date.now();
  const outputLimit = normalizeOutputLimit(maxOutputBytes);
  const stdoutState = { bytes: 0, omittedBytes: 0, truncated: false, chunks: [] };
  const stderrState = { bytes: 0, omittedBytes: 0, truncated: false, chunks: [] };
  let spawnError = null;
  let stdinError = null;
  let timedOut = false;
  const terminationAttempts = [];

  return new Promise((resolve) => {
    let settled = false;
    let child;
    let timer;
    let forceKillTimer;
    let absoluteWatchdog;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (absoluteWatchdog) clearTimeout(absoluteWatchdog);
      resolve(result);
    };

    try {
      child = spawn(command, args, {
        cwd,
        env,
        shell: false,
        windowsHide: true,
        detached: process.platform !== 'win32',
        stdio: capture ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
      });
    } catch (error) {
      resolve({
        label,
        command,
        args: sanitizedArgs(args),
        ok: false,
        code: null,
        signal: null,
        timedOut: false,
        error,
        errorMessage: error.message,
        stdout: capturedOutput(stdoutState, outputLimit),
        stderr: capturedOutput(stderrState, outputLimit),
        stdoutTruncated: stdoutState.truncated,
        stderrTruncated: stderrState.truncated,
        stdinError: null,
        terminationAttempts,
        ms: Date.now() - startedAt,
      });
      return;
    }

    timer = setTimeout(() => {
      timedOut = true;
      terminationAttempts.push({ signal: 'SIGTERM', requested: terminateProcessTree(child, 'SIGTERM') });
      forceKillTimer = setTimeout(() => {
        terminationAttempts.push({ signal: 'SIGKILL', requested: terminateProcessTree(child, 'SIGKILL') });
      }, 5_000);
      absoluteWatchdog = setTimeout(() => {
        settle({
          label, command, args: sanitizedArgs(args), ok: false, code: null, signal: null,
          timedOut: true, error: null, errorMessage: `process did not close within absolute watchdog after ${timeoutMs}ms timeout`,
          stdout: capturedOutput(stdoutState, outputLimit), stderr: capturedOutput(stderrState, outputLimit),
          stdoutTruncated: stdoutState.truncated, stderrTruncated: stderrState.truncated,
          stdinError: stdinError?.message ?? null, terminationAttempts, ms: Date.now() - startedAt,
        });
      }, 10_000);
    }, timeoutMs);

    child.on('error', (error) => {
      spawnError = error;
      settle({
        label,
        command,
        args: sanitizedArgs(args),
        ok: false,
        code: null,
        signal: null,
        timedOut,
        error,
        errorMessage: error.message,
        stdout: capturedOutput(stdoutState, outputLimit),
        stderr: capturedOutput(stderrState, outputLimit),
        stdoutTruncated: stdoutState.truncated,
        stderrTruncated: stderrState.truncated,
        stdinError: stdinError?.message ?? null,
        terminationAttempts,
        ms: Date.now() - startedAt,
      });
    });

    if (capture) {
      child.stdout?.on('data', (chunk) => {
        appendCapturedChunk(chunk, stdoutState, outputLimit);
      });
      child.stderr?.on('data', (chunk) => {
        appendCapturedChunk(chunk, stderrState, outputLimit);
      });
    }

    child.stdin?.on('error', (error) => {
      stdinError = error;
    });
    if (input !== undefined && child.stdin) {
      try { child.stdin.end(input); } catch (error) { stdinError = error; }
    } else {
      child.stdin?.end();
    }

    child.on('close', (code, signal) => {
      const errorMessage = spawnError?.message
        ?? (timedOut ? `timed out after ${timeoutMs}ms` : null);
      settle({
        label,
        command,
        args: sanitizedArgs(args),
        ok: !spawnError && !timedOut && code === 0,
        code,
        signal,
        timedOut,
        error: spawnError,
        errorMessage,
        stdout: capturedOutput(stdoutState, outputLimit),
        stderr: capturedOutput(stderrState, outputLimit),
        stdoutTruncated: stdoutState.truncated,
        stderrTruncated: stderrState.truncated,
        stdinError: stdinError?.message ?? null,
        terminationAttempts,
        ms: Date.now() - startedAt,
      });
    });
  });
}

export async function captureProcess(label, command, args = [], options = {}) {
  return runProcess(label, command, args, { ...options, capture: true });
}

export async function commandExists(command, args = ['--version'], options = {}) {
  const result = await captureProcess(`probe ${command}`, command, args, {
    timeoutMs: DEFAULT_PROBE_TIMEOUT_MS,
    ...options,
  });
  return result.ok;
}

export async function commandDetails(command, args = ['--version'], options = {}) {
  const result = await captureProcess(`probe ${command}`, command, args, {
    timeoutMs: DEFAULT_PROBE_TIMEOUT_MS,
    ...options,
  });
  if (!result.ok) {
    return { available: false, detail: 'not available', result };
  }
  const detail = `${result.stdout ?? ''}${result.stderr ?? ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  return { available: true, detail: detail || 'available', result };
}

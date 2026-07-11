import { spawn } from 'node:child_process';

export const DEFAULT_TIMEOUT_MS = 120_000;
export const DEFAULT_PROBE_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576;

export function formatCommand(command, args = []) {
  return [command, ...args].join(' ');
}

function normalizeOutputLimit(value) {
  if (value === null || value === false || value === Number.POSITIVE_INFINITY) {
    return Number.POSITIVE_INFINITY;
  }
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_MAX_OUTPUT_BYTES;
}

function appendCapturedChunk(current, chunk, state, maxBytes) {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
  if (maxBytes === Number.POSITIVE_INFINITY) {
    state.bytes += buffer.length;
    return current + buffer.toString('utf8');
  }

  const remaining = maxBytes - state.bytes;
  if (remaining <= 0) {
    state.truncated = true;
    state.omittedBytes += buffer.length;
    return current;
  }

  if (buffer.length <= remaining) {
    state.bytes += buffer.length;
    return current + buffer.toString('utf8');
  }

  state.bytes += remaining;
  state.truncated = true;
  state.omittedBytes += buffer.length - remaining;
  return current + buffer.subarray(0, remaining).toString('utf8');
}

function capturedOutput(value, state, maxBytes) {
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
  const stdoutState = { bytes: 0, omittedBytes: 0, truncated: false };
  const stderrState = { bytes: 0, omittedBytes: 0, truncated: false };
  let stdout = '';
  let stderr = '';
  let spawnError = null;
  let timedOut = false;

  return new Promise((resolve) => {
    let settled = false;
    let child;
    let timer;
    let forceKillTimer;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      resolve(result);
    };

    try {
      child = spawn(command, args, {
        cwd,
        env,
        shell: false,
        windowsHide: true,
        stdio: capture ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'inherit', 'inherit'],
      });
    } catch (error) {
      resolve({
        label,
        command,
        args,
        ok: false,
        code: null,
        signal: null,
        timedOut: false,
        error,
        errorMessage: error.message,
        stdout: capturedOutput(stdout, stdoutState, outputLimit),
        stderr: capturedOutput(stderr, stderrState, outputLimit),
        stdoutTruncated: stdoutState.truncated,
        stderrTruncated: stderrState.truncated,
        ms: Date.now() - startedAt,
      });
      return;
    }

    timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => {
        child.kill('SIGKILL');
      }, 5_000);
    }, timeoutMs);

    child.on('error', (error) => {
      spawnError = error;
      settle({
        label,
        command,
        args,
        ok: false,
        code: null,
        signal: null,
        timedOut,
        error,
        errorMessage: error.message,
        stdout: capturedOutput(stdout, stdoutState, outputLimit),
        stderr: capturedOutput(stderr, stderrState, outputLimit),
        stdoutTruncated: stdoutState.truncated,
        stderrTruncated: stderrState.truncated,
        ms: Date.now() - startedAt,
      });
    });

    if (capture) {
      child.stdout?.on('data', (chunk) => {
        stdout = appendCapturedChunk(stdout, chunk, stdoutState, outputLimit);
      });
      child.stderr?.on('data', (chunk) => {
        stderr = appendCapturedChunk(stderr, chunk, stderrState, outputLimit);
      });
    }

    if (input !== undefined && child.stdin) {
      child.stdin.end(input);
    } else {
      child.stdin?.end();
    }

    child.on('close', (code, signal) => {
      const errorMessage = spawnError?.message
        ?? (timedOut ? `timed out after ${timeoutMs}ms` : null);
      settle({
        label,
        command,
        args,
        ok: !spawnError && !timedOut && code === 0,
        code,
        signal,
        timedOut,
        error: spawnError,
        errorMessage,
        stdout: capturedOutput(stdout, stdoutState, outputLimit),
        stderr: capturedOutput(stderr, stderrState, outputLimit),
        stdoutTruncated: stdoutState.truncated,
        stderrTruncated: stderrState.truncated,
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

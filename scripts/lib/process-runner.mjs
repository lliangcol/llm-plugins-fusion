import { spawn } from 'node:child_process';

export const DEFAULT_TIMEOUT_MS = 120_000;
export const DEFAULT_PROBE_TIMEOUT_MS = 10_000;

export function formatCommand(command, args = []) {
  return [command, ...args].join(' ');
}

export function runProcess(label, command, args = [], options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    input,
    shell = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    capture = true,
  } = options;

  const startedAt = Date.now();
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
        shell,
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
        stdout,
        stderr,
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
        stdout,
        stderr,
        ms: Date.now() - startedAt,
      });
    });

    if (capture) {
      child.stdout?.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr?.on('data', (chunk) => {
        stderr += chunk;
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
        stdout,
        stderr,
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

import { existsSync } from 'node:fs';

export function resolveBashCommand(platform = process.platform, env = process.env) {
  if (platform !== 'win32') return env.NOVA_BASH_BIN || 'bash';
  const candidates = [
    env.NOVA_BASH_BIN,
    env.ProgramFiles ? `${env.ProgramFiles}\\Git\\bin\\bash.exe` : null,
    env.ProgramFiles ? `${env.ProgramFiles}\\Git\\usr\\bin\\bash.exe` : null,
    env.LOCALAPPDATA ? `${env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe` : null,
  ].filter((candidate) => typeof candidate === 'string');
  return candidates.find((candidate) => existsSync(candidate)) ?? 'bash';
}

export function pathForBash(value, command = resolveBashCommand(), platform = process.platform) {
  if (platform !== 'win32') return value;
  const match = value.match(/^([A-Za-z]):[\\/](.*)$/u);
  if (!match) return value.replaceAll('\\', '/');
  const drive = match[1].toLowerCase();
  const rest = match[2].replaceAll('\\', '/');
  return /Git[\\/](?:bin|usr[\\/]bin)[\\/]bash\.exe$/iu.test(command)
    ? `/${drive}/${rest}`
    : `/mnt/${drive}/${rest}`;
}

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const hashFile = (path) => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;

export function validationEvidenceDigests(root) {
  return {
    registry: hashFile(resolve(root, 'scripts/lib/validation-task-registry.mjs')),
    policy: hashFile(resolve(root, 'governance/validation-performance.json')),
  };
}

export function validationProfile({ concurrency, scenario = process.env.NOVA_VALIDATION_SCENARIO ?? 'fresh-process-full-uncached' }) {
  const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : process.platform;
  const runnerClass = process.env.NOVA_RUNNER_CLASS ?? 'unknown';
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const comparable = runnerClass !== 'unknown' && scenario !== 'cpu-profile';
  const id = `${platform}-${process.arch}-node${nodeMajor}-${runnerClass}-${concurrency}-${scenario}`;
  return { id, platform, arch: process.arch, nodeMajor, runnerClass, concurrency, scenario, comparable };
}

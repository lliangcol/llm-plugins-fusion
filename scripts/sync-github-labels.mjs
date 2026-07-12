#!/usr/bin/env node
/** Create or update source-controlled GitHub labels; never delete labels. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { repoRoot } from './lib/repo-root.mjs';
import { diffLabels, parseLabelCatalog } from './lib/label-catalog.mjs';

const root = repoRoot(import.meta.url);

async function request(path, { method = 'GET', body, token, fetchImpl }) {
  const response = await fetchImpl(`https://api.github.com${path}`, { method, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'llm-plugins-fusion-label-sync' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`GitHub API ${method} ${path} failed with ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function listLabels(repository, token, fetchImpl) {
  const labels = [];
  for (let page = 1; page <= 20; page += 1) {
    const batch = await request(`/repos/${repository}/labels?per_page=100&page=${page}`, { token, fetchImpl });
    labels.push(...batch);
    if (batch.length < 100) return labels;
  }
  throw new Error('GitHub label inventory exceeded the 2000-label safety limit');
}

export async function syncLabels({ args = process.argv.slice(2), env = process.env, fetchImpl = fetch, sourceRoot = root } = {}) {
  const apply = args.includes('--apply');
  if (args.some((arg) => arg !== '--apply')) throw new Error('Usage: node scripts/sync-github-labels.mjs [--apply]');
  const repository = env.GITHUB_REPOSITORY;
  const token = env.GH_TOKEN ?? env.GITHUB_TOKEN;
  if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GH_TOKEN are required');
  const desired = parseLabelCatalog(readFileSync(resolve(sourceRoot, '.github/labels.yml'), 'utf8'));
  const actual = await listLabels(repository, token, fetchImpl);
  const diff = diffLabels(desired, actual);
  if (apply) {
    for (const label of diff.create) await request(`/repos/${repository}/labels`, { method: 'POST', body: label, token, fetchImpl });
    for (const label of diff.update) await request(`/repos/${repository}/labels/${encodeURIComponent(label.name)}`, { method: 'PATCH', body: label, token, fetchImpl });
  }
  return { apply, diff };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { apply, diff } = await syncLabels();
    console.log(`${apply ? 'Applied' : 'Checked'} labels: create=${diff.create.length} update=${diff.update.length} unchanged=${diff.unchanged} delete=0`);
    if (!apply && (diff.create.length || diff.update.length)) process.exitCode = 1;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    process.exitCode = 1;
  }
}

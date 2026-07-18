const HUMAN_LOGIN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/u;
const BOT_LOGIN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?\[bot\]$/u;
const TEAM_SLUG = /^[a-z0-9][a-z0-9_.-]*$/u;

/** Normalize a GitHub account identity for security comparisons. */
export function normalizeGithubLogin(value, label = 'GitHub login', { allowBot = true } = {}) {
  if (typeof value !== 'string') throw new Error(`${label} must be a non-empty GitHub login`);
  const normalized = value.trim().replace(/^@/u, '').toLowerCase();
  if (!HUMAN_LOGIN.test(normalized) && !(allowBot && BOT_LOGIN.test(normalized))) {
    throw new Error(`${label} must be a valid GitHub login`);
  }
  return normalized;
}

/** Normalize an org/team policy identity for security comparisons. */
export function normalizeGithubTeam(value, label = 'GitHub team') {
  if (typeof value !== 'string') throw new Error(`${label} must be an organization/team identity`);
  const normalized = value.trim().replace(/^@/u, '').toLowerCase();
  const parts = normalized.split('/');
  if (parts.length !== 2 || !HUMAN_LOGIN.test(parts[0]) || !TEAM_SLUG.test(parts[1])) {
    throw new Error(`${label} must be an organization/team identity`);
  }
  return normalized;
}

export function normalizeCommitIdentity(value, label = 'commit identity', { fullSha = false } = {}) {
  if (typeof value !== 'string') throw new Error(`${label} must be a non-empty commit identity`);
  const normalized = value.trim().toLowerCase();
  const pattern = fullSha ? /^[a-f0-9]{40}$/u : /^[a-z0-9._-]+$/u;
  if (!pattern.test(normalized)) throw new Error(`${label} must be ${fullSha ? 'a 40-character hexadecimal SHA' : 'a non-empty commit identity'}`);
  return normalized;
}

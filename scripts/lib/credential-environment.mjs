/** Environment projection for child gates that must never receive GitHub credentials. */

const githubCredentialKeys = new Set([
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GH_ENTERPRISE_TOKEN',
  'GITHUB_ENTERPRISE_TOKEN',
]);

/** @param {NodeJS.ProcessEnv} [env] */
export function withoutGithubCredentials(env = process.env) {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => !githubCredentialKeys.has(key.toUpperCase())),
  );
}

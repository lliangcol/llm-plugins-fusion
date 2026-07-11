export const SEMVER_PATTERN_SOURCE = String.raw`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$`;

const SEMVER_PATTERN = new RegExp(SEMVER_PATTERN_SOURCE);

export function parseSemVer(value) {
  if (typeof value !== 'string') return null;
  const match = SEMVER_PATTERN.exec(value);
  if (!match) return null;
  return {
    version: value,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || null,
    build: match[5] || null,
    isPrerelease: Boolean(match[4]),
  };
}

export function requireSemVer(value, label = 'version') {
  const parsed = parseSemVer(value);
  if (!parsed) {
    throw new Error(`${label} must be a valid SemVer 2.0.0 version`);
  }
  return parsed;
}

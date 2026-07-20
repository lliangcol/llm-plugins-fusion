export const SEMVER_PATTERN_SOURCE = String.raw`^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$`;

const SEMVER_PATTERN = new RegExp(SEMVER_PATTERN_SOURCE);

export function semverMajor(value) {
  if (typeof value !== 'string') return null;
  const match = SEMVER_PATTERN.exec(value);
  return match ? Number.parseInt(match[1], 10) : null;
}

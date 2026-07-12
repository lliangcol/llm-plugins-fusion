/** Evidence freshness helper for compatibility registries. */
export function evidenceFreshness(expectedDigests, actualDigest) {
  const staleReasons = [];
  for (const [path, expected] of Object.entries(expectedDigests ?? {})) {
    const actual = actualDigest(path);
    if (actual === null) staleReasons.push(`${path}:missing`);
    else if (actual !== expected) staleReasons.push(`${path}:digest-changed`);
  }
  return { current: staleReasons.length === 0, staleReasons };
}

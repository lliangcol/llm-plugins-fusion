export const releaseChecksumSourcePaths = Object.freeze([
  'nova-plugin/.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.claude-plugin/marketplace.canary.json',
  '.claude-plugin/marketplace.metadata.json',
  'docs/marketplace/catalog.md',
]);

export function releaseArtifactNames(stableVersion) {
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(stableVersion ?? '')) {
    throw new Error('release checksum contract requires a stable SemVer version');
  }
  return Object.freeze([
    `nova-plugin-${stableVersion}.tar.gz`,
    'artifact-manifest.json',
    'build-sbom.cdx.json',
    'runtime-capabilities.cdx.json',
    'nova-build-record.json',
  ]);
}

export function releaseChecksumPaths(stableVersion) {
  return Object.freeze([
    ...releaseChecksumSourcePaths,
    ...releaseArtifactNames(stableVersion).map((name) => `.metrics/release-artifacts/${name}`),
  ]);
}

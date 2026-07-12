import { canonicalSha256 } from './canonical-json.mjs';

export const releaseStates = Object.freeze([
  'DRAFT',
  'CANDIDATE_TAGGED',
  'CANDIDATE_VERIFIED',
  'PROMOTION_READY',
  'STABLE_TAG_VERIFIED',
  'RELEASE_DRAFT_CREATED',
  'ASSETS_RECONCILED',
  'RELEASE_PUBLISHED',
  'STABLE_CHANNEL_PINNED',
  'INSTALL_PROVEN',
]);

export function assertReleaseTransition(from, to) {
  const fromIndex = releaseStates.indexOf(from);
  const toIndex = releaseStates.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || toIndex !== fromIndex + 1) {
    throw new Error(`illegal release transition ${from}->${to}`);
  }
  return true;
}

export function planReleaseTransitions(from, to) {
  const fromIndex = releaseStates.indexOf(from);
  const toIndex = releaseStates.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || toIndex < fromIndex) throw new Error(`invalid release state range ${from}->${to}`);
  return releaseStates.slice(fromIndex, toIndex + 1).slice(1).map((state, index) => ({
    from: releaseStates[fromIndex + index],
    to: state,
  }));
}

export function createTransitionEvent({ transition, identity, inputDigests = {}, outputDigests = {}, runId, createdAt, previousEventSha256 = null }) {
  assertReleaseTransition(transition.from, transition.to);
  const event = {
    schemaVersion: 1,
    transition: `${transition.from}->${transition.to}`,
    stableTag: identity.stableTag,
    candidateTag: identity.candidateTag,
    sourceCommit: identity.sourceCommit,
    candidateManifestSha256: identity.candidateManifestSha256,
    controlBundleSha256: identity.controlBundleSha256,
    inputDigests,
    outputDigests,
    runId,
    createdAt,
    previousEventSha256,
  };
  return { event, sha256: canonicalSha256(event) };
}

export function reconcileReleaseAssets(expected, actual) {
  const actualByName = new Map(actual.map((asset) => [asset.name, asset]));
  const upload = [];
  const reuse = [];
  const quarantine = [];
  for (const asset of expected) {
    const existing = actualByName.get(asset.name);
    if (!existing) upload.push(asset);
    else if (existing.sha256 === asset.sha256 && existing.bytes === asset.bytes) reuse.push(asset);
    else quarantine.push({ expected: asset, actual: existing, reason: 'same-name-different-content' });
    actualByName.delete(asset.name);
  }
  for (const unexpected of actualByName.values()) quarantine.push({ actual: unexpected, reason: 'unexpected-asset' });
  return { upload, reuse, quarantine, publishable: quarantine.length === 0 };
}

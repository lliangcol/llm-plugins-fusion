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

export function createTransitionEvent({ transition, identity, inputDigests = {}, outputDigests = {}, mode, runId, createdAt, previousEventSha256 = null }) {
  assertReleaseTransition(transition.from, transition.to);
  assertModeTransition(mode, transition);
  const event = {
    schemaVersion: 2,
    transition: `${transition.from}->${transition.to}`,
    mode,
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

export function createReleaseLedger(identity) {
  return { schemaVersion: 2, identity: { ...identity }, headState: 'DRAFT', headSha256: null, events: [] };
}

function assertModeTransition(mode, transition) {
  if (!['promote', 'recover', 'drill'].includes(mode)) throw new Error(`unknown release mode ${mode}`);
  if (mode === 'recover' && transition.from === 'DRAFT') throw new Error('recover mode requires a prior release transition');
  if (mode === 'drill' && releaseStates.indexOf(transition.to) > releaseStates.indexOf('PROMOTION_READY')) throw new Error('drill mode cannot cross the promotion-ready boundary');
}

export function verifyReleaseLedger(ledger) {
  if (!ledger || ledger.schemaVersion !== 2 || !ledger.identity || !Array.isArray(ledger.events)) throw new Error('invalid release ledger structure');
  let state = 'DRAFT';
  let previous = null;
  const seenDigests = new Set();
  const seenTransitions = new Set();
  for (const record of ledger.events) {
    if (!record?.event || typeof record.sha256 !== 'string') throw new Error('invalid release ledger record');
    const digest = canonicalSha256(record.event);
    if (digest !== record.sha256) throw new Error('release ledger event digest mismatch');
    if (seenDigests.has(digest) || seenTransitions.has(record.event.transition)) throw new Error('duplicate release ledger transition');
    const [from, to] = record.event.transition.split('->');
    assertReleaseTransition(from, to);
    if (record.event.mode !== record.mode) throw new Error('release ledger event mode mismatch');
    assertModeTransition(record.mode, { from, to });
    if (from !== state || record.event.previousEventSha256 !== previous) throw new Error('release ledger chain is reordered or disconnected');
    for (const key of ['stableTag', 'candidateTag', 'sourceCommit', 'candidateManifestSha256', 'controlBundleSha256']) {
      if (record.event[key] !== ledger.identity[key]) throw new Error(`release ledger identity mismatch for ${key}`);
    }
    seenDigests.add(digest); seenTransitions.add(record.event.transition); state = to; previous = digest;
  }
  if (ledger.headState !== state || ledger.headSha256 !== previous) throw new Error('release ledger head mismatch');
  return { headState: state, headSha256: previous, events: ledger.events.length };
}

export function appendReleaseLedger(ledger, eventOptions, mode) {
  const verified = verifyReleaseLedger(ledger);
  assertModeTransition(mode, eventOptions.transition);
  if (eventOptions.transition.from !== verified.headState) throw new Error('release transition does not continue the ledger head');
  const created = createTransitionEvent({ ...eventOptions, mode, previousEventSha256: verified.headSha256 });
  const next = structuredClone(ledger);
  next.events.push({ mode, event: created.event, sha256: created.sha256 });
  next.headState = eventOptions.transition.to;
  next.headSha256 = created.sha256;
  verifyReleaseLedger(next);
  return next;
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

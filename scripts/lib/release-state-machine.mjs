import { canonicalSha256 } from './canonical-json.mjs';

const stableTagPattern = /^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const candidateTagPattern = /^v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)-rc\.(?:0|[1-9][0-9]*)$/u;
const commitPattern = /^[a-f0-9]{40}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/u;
const identityKeys = Object.freeze([
  'stableTag', 'candidateTag', 'sourceCommit', 'candidateManifestSha256', 'controlBundleSha256',
]);
const eventKeys = Object.freeze([
  'schemaVersion', 'transition', 'mode', ...identityKeys, 'inputDigests', 'outputDigests',
  'runId', 'createdAt', 'previousEventSha256',
]);

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error(`${label} has an invalid field inventory`);
  }
}

function assertReleaseIdentity(identity) {
  assertExactKeys(identity, identityKeys, 'release identity');
  if (typeof identity.stableTag !== 'string'
    || typeof identity.candidateTag !== 'string'
    || typeof identity.sourceCommit !== 'string'
    || typeof identity.candidateManifestSha256 !== 'string'
    || typeof identity.controlBundleSha256 !== 'string'
    || !stableTagPattern.test(identity.stableTag)
    || !candidateTagPattern.test(identity.candidateTag)
    || identity.candidateTag.split('-rc.')[0] !== identity.stableTag
    || !commitPattern.test(identity.sourceCommit)
    || !digestPattern.test(identity.candidateManifestSha256)
    || !digestPattern.test(identity.controlBundleSha256)) {
    throw new Error('release identity is malformed or mismatched');
  }
}

function assertDigestMap(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a digest map`);
  for (const [key, digest] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9._-]*$/u.test(key)
      || typeof digest !== 'string' || !digestPattern.test(digest)) {
      throw new Error(`${label} contains an invalid digest entry`);
    }
  }
}

function validTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = timestampPattern.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetSign, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    && hour <= 23 && minute <= 59 && second <= 59
    && (!offsetSign || (Number(offsetHourText) <= 23 && Number(offsetMinuteText) <= 59));
}

function assertTransitionEventStructure(event) {
  assertExactKeys(event, eventKeys, 'release transition event');
  if (event.schemaVersion !== 2) throw new Error('release transition event schemaVersion must be 2');
  assertReleaseIdentity(Object.fromEntries(identityKeys.map((key) => [key, event[key]])));
  assertDigestMap(event.inputDigests, 'release transition inputDigests');
  assertDigestMap(event.outputDigests, 'release transition outputDigests');
  if (typeof event.runId !== 'string' || event.runId.length === 0
    || event.runId !== event.runId.trim() || /\p{Cc}/u.test(event.runId)) {
    throw new Error('release transition runId is invalid');
  }
  if (!validTimestamp(event.createdAt)) {
    throw new Error('release transition createdAt is invalid');
  }
  if (event.previousEventSha256 !== null
    && (typeof event.previousEventSha256 !== 'string' || !digestPattern.test(event.previousEventSha256))) {
    throw new Error('release transition previousEventSha256 is invalid');
  }
}

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
  const transitions = [];
  for (let index = fromIndex + 1; index <= toIndex; index += 1) {
    transitions.push({ from: releaseStates[index - 1], to: releaseStates[index] });
  }
  return transitions;
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
  assertTransitionEventStructure(event);
  return { event, sha256: canonicalSha256(event) };
}

export function createReleaseLedger(identity) {
  assertReleaseIdentity(identity);
  return { schemaVersion: 2, identity: { ...identity }, headState: 'DRAFT', headSha256: null, events: [] };
}

function assertModeTransition(mode, transition) {
  if (!['promote', 'recover', 'drill'].includes(mode)) throw new Error(`unknown release mode ${mode}`);
  if (mode === 'recover' && transition.from === 'DRAFT') throw new Error('recover mode requires a prior release transition');
  if (mode === 'drill' && releaseStates.indexOf(transition.to) > releaseStates.indexOf('PROMOTION_READY')) throw new Error('drill mode cannot cross the promotion-ready boundary');
}

export function verifyReleaseLedger(ledger) {
  if (!ledger || ledger.schemaVersion !== 2 || !ledger.identity || !Array.isArray(ledger.events)) throw new Error('invalid release ledger structure');
  assertExactKeys(ledger, ['schemaVersion', 'identity', 'headState', 'headSha256', 'events'], 'release ledger');
  assertReleaseIdentity(ledger.identity);
  if (!releaseStates.includes(ledger.headState)
    || (ledger.headSha256 !== null
      && (typeof ledger.headSha256 !== 'string' || !digestPattern.test(ledger.headSha256)))) {
    throw new Error('invalid release ledger head');
  }
  let state = 'DRAFT';
  let previous = null;
  const seenDigests = new Set();
  const seenTransitions = new Set();
  for (const record of ledger.events) {
    if (!record?.event || typeof record.sha256 !== 'string') throw new Error('invalid release ledger record');
    assertExactKeys(record, ['mode', 'event', 'sha256'], 'release ledger record');
    if (!digestPattern.test(record.sha256)) throw new Error('invalid release ledger record digest');
    assertTransitionEventStructure(record.event);
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
  const actualByName = new Map();
  for (const asset of actual) actualByName.set(asset.name, asset);
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

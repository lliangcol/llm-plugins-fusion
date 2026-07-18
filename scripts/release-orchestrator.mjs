#!/usr/bin/env node
/** One explicit-identity release state machine for promote, recover, and drill. */

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonicalSha256 } from './lib/canonical-json.mjs';
import { appendReleaseLedger, createReleaseLedger, planReleaseTransitions, releaseStates, verifyReleaseLedger } from './lib/release-state-machine.mjs';
import { requireOptionValue } from './lib/cli-args.mjs';
import { assertReleaseReady, evaluateReleaseCorrections, loadReleaseCorrections } from './lib/release-corrections.mjs';
import { createPhysicalReadBoundary, readPhysicalFile } from './lib/physical-read-boundary.mjs';
import {
  prepareArtifactOutputPlan,
  resolveArtifactOutputPath,
  writeArtifactOutput,
} from './lib/artifact-output.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function releaseEventPath(eventDir, sequence, transition) {
  return resolve(eventDir, `${String(sequence).padStart(2, '0')}-${transition.replace('->', '-to-').toLowerCase()}.json`);
}

const releaseIdentityKeys = Object.freeze([
  'stableTag',
  'candidateTag',
  'sourceCommit',
  'candidateManifestSha256',
  'controlBundleSha256',
]);

function assertLedgerIdentity(ledger, identity) {
  for (const key of releaseIdentityKeys) {
    if (ledger.identity?.[key] !== identity[key]) {
      throw new Error(`existing release ledger identity differs for ${key}`);
    }
  }
}

function readPhysicalJson(path, label) {
  const boundary = createPhysicalReadBoundary(dirname(path), `${label} parent`);
  const file = readPhysicalFile(boundary, path, label);
  try {
    return JSON.parse(file.buffer.toString('utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`, { cause: error });
  }
}

export function parseReleaseOrchestratorArgs(args) {
  const options = { mode: null, state: null, targetState: null, stableTag: null, candidateTag: null, sourceCommit: null, promotionIntent: null, controlBundle: null, eventDir: null, runId: null, dryRun: false, candidateVerificationPassed: false, protectedPublicationApproved: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') { options.dryRun = true; continue; }
    if (arg === '--candidate-verification-passed') { options.candidateVerificationPassed = true; continue; }
    if (arg === '--protected-publication-approved') { options.protectedPublicationApproved = true; continue; }
    const value = () => requireOptionValue(args, index, arg);
    if (arg === '--mode') options.mode = value();
    else if (arg === '--state') options.state = value();
    else if (arg === '--target-state') options.targetState = value();
    else if (arg === '--stable-tag') options.stableTag = value();
    else if (arg === '--candidate-tag') options.candidateTag = value();
    else if (arg === '--source-commit') options.sourceCommit = value();
    else if (arg === '--promotion-intent') options.promotionIntent = resolve(root, value());
    else if (arg === '--control-bundle') options.controlBundle = resolve(root, value());
    else if (arg === '--event-dir') options.eventDir = resolveArtifactOutputPath(root, value(), 'release event directory');
    else if (arg === '--run-id') options.runId = value();
    else throw new Error(`unknown argument: ${arg}`);
    index += 1;
  }
  for (const key of ['mode', 'state', 'targetState', 'stableTag', 'candidateTag', 'sourceCommit', 'promotionIntent', 'controlBundle', 'eventDir', 'runId']) {
    if (!options[key]) throw new Error(`missing required release identity option: ${key}`);
  }
  if (!['promote', 'recover', 'drill'].includes(options.mode)) throw new Error('mode must be promote, recover, or drill');
  if (!/^[a-f0-9]{40}$/u.test(options.sourceCommit)) throw new Error('source commit must be a full Git SHA');
  return options;
}

export function orchestrateRelease(options, now = () => new Date(), correctionSource = loadReleaseCorrections(root)) {
  const eventDir = resolveArtifactOutputPath(root, options.eventDir, 'release event directory');
  const intent = readPhysicalJson(options.promotionIntent, 'release promotion intent');
  const control = readPhysicalJson(options.controlBundle, 'release control bundle manifest');
  if (intent.stableTag !== options.stableTag || intent.candidateTag !== options.candidateTag || intent.sourceCommit !== options.sourceCommit) {
    throw new Error('explicit release identity differs from promotion intent');
  }
  if (intent.controlBundleSha256 !== control.bundleSha256) throw new Error('promotion intent differs from the release control bundle');
  if (intent.correctionsSha256 !== correctionSource.sha256) throw new Error('promotion intent contains stale release correction evidence');
  const promotionIntentSha256 = canonicalSha256(intent);
  const releasePolicy = evaluateReleaseCorrections({
    mode: options.mode, stableTag: options.stableTag, candidateTag: options.candidateTag, sourceCommit: options.sourceCommit,
    corrections: correctionSource.document.corrections, correctionsSha256: correctionSource.sha256,
    independentReview: { passed: options.candidateVerificationPassed },
    candidateVerification: { passed: options.candidateVerificationPassed },
    protectedPublication: { passed: options.protectedPublicationApproved },
  });
  if (releasePolicy.status === 'BLOCKED_POLICY') assertReleaseReady(releasePolicy);
  const transitions = planReleaseTransitions(options.state, options.targetState);
  const maximumIndex = releaseStates.indexOf(releasePolicy.maximumPermittedState);
  if (releaseStates.indexOf(options.targetState) > maximumIndex) throw new Error(`release policy limits orchestration to ${releasePolicy.maximumPermittedState}`);
  const identity = {
    stableTag: options.stableTag,
    candidateTag: options.candidateTag,
    sourceCommit: options.sourceCommit,
    candidateManifestSha256: intent.candidateCoreSha256,
    controlBundleSha256: intent.controlBundleSha256,
  };
  const ledgerPath = resolve(eventDir, 'release-ledger.json');
  let ledger;
  if (existsSync(ledgerPath)) {
    ledger = readPhysicalJson(ledgerPath, 'release ledger');
    const verified = verifyReleaseLedger(ledger);
    assertLedgerIdentity(ledger, identity);
    if (ledger.events.some((record) => record.event?.inputDigests?.promotionIntent !== promotionIntentSha256)) {
      throw new Error('existing release ledger is bound to a different promotion intent');
    }
    if (verified.headState === options.targetState) {
      const finalEvent = ledger.events.at(-1);
      if (finalEvent && finalEvent.mode !== options.mode) {
        throw new Error('existing release target was reached by a different orchestration mode');
      }
      return {
        mode: options.mode,
        transitions: [],
        ledgerHeadState: verified.headState,
        ledgerHeadSha256: verified.headSha256,
        controlBundle: basename(options.controlBundle),
        resumed: true,
      };
    }
    if (options.state === 'DRAFT') throw new Error('release ledger already exists; refusing conflicting initial transition');
    if (verified.headState !== options.state) throw new Error('requested release state differs from prior release ledger head');
  } else if (options.state === 'DRAFT') {
    ledger = createReleaseLedger(identity);
  } else {
    throw new Error('prior release ledger is required for continuation');
  }
  const existingEventCount = ledger.events.length;
  for (const transition of transitions) {
    const sequence = ledger.events.length + 1;
    const path = releaseEventPath(eventDir, sequence, `${transition.from}->${transition.to}`);
    let createdAt = now().toISOString();
    let existingEvent = null;
    if (!options.dryRun && existsSync(path)) {
      existingEvent = readPhysicalJson(path, `release event ${basename(path)}`);
      createdAt = existingEvent.createdAt;
      if (existingEvent.mode !== options.mode) {
        throw new Error(`existing release event mode conflicts with the requested orchestration: ${basename(path)}`);
      }
      if (!Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString() !== createdAt) {
        throw new Error(`existing release event has an invalid timestamp: ${basename(path)}`);
      }
    }
    const next = appendReleaseLedger(ledger, {
      transition,
      identity,
      inputDigests: { promotionIntent: promotionIntentSha256 },
      outputDigests: {},
      runId: existingEvent?.runId ?? options.runId,
      createdAt,
    }, options.mode);
    const appended = next.events.at(-1);
    if (existingEvent && canonicalSha256(existingEvent) !== appended.sha256) {
      throw new Error(`existing release event conflicts with the requested transition: ${basename(path)}`);
    }
    ledger = next;
  }
  if (!options.dryRun) {
    const pendingEvents = ledger.events.slice(existingEventCount).map(({ event }, index) => {
      const sequence = String(existingEventCount + index + 1).padStart(2, '0');
      const path = releaseEventPath(eventDir, sequence, event.transition);
      const content = `${JSON.stringify(event, null, 2)}\n`;
      return { key: `event-${sequence}`, path, content, label: `release event ${sequence} output` };
    });
    const outputPlan = prepareArtifactOutputPlan(root, [
      ...pendingEvents.map(({ key, path, label }) => ({ key, path, label })),
      { key: 'ledger', path: ledgerPath, label: 'release ledger output' },
    ], { protectedPaths: [options.promotionIntent, options.controlBundle] });
    for (const { key, path, content } of pendingEvents) {
      if (existsSync(path)) {
        if (readFileSync(path, 'utf8') !== content) throw new Error(`existing release event bytes conflict: ${basename(path)}`);
      } else {
        writeArtifactOutput(outputPlan, key, content);
      }
    }
    writeArtifactOutput(outputPlan, 'ledger', `${JSON.stringify(ledger, null, 2)}\n`);
  }
  const appended = ledger.events.slice(existingEventCount);
  return { mode: options.mode, transitions: appended.map(({ event, sha256 }) => ({ transition: event.transition, sha256 })), ledgerHeadState: ledger.headState, ledgerHeadSha256: ledger.headSha256, controlBundle: basename(options.controlBundle) };
}

export function main(args = process.argv.slice(2)) {
  try {
    const result = orchestrateRelease(parseReleaseOrchestratorArgs(args));
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (error) {
    console.error(`ERROR ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main();
